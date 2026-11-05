"""Marking an OMR sheet must not stall other requests in the same process, and must give
the same answers and errors as before. Runs without Postgres."""

import asyncio
import io
import os
import sys
import threading
import time
import unittest
import uuid
from unittest import mock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))
os.environ.setdefault("JWT_SECRET_KEY", "x" * 40)

from fastapi import HTTPException, UploadFile  # noqa: E402

from backend.omr import service  # noqa: E402

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


class _SlowEvaluator:
    active = 0
    most_at_once = 0
    lock = threading.Lock()

    def load_image_from_bytes(self, content, filename):
        return ["page"]

    def evaluate_sheet(self, image, max_marks, student_roster):
        with self.lock:
            type(self).active += 1
            type(self).most_at_once = max(type(self).most_at_once, type(self).active)
        time.sleep(0.3)  # blocks its thread, as real image processing does
        with self.lock:
            type(self).active -= 1
        return {"max_marks": max_marks, "roster": student_roster}


def _upload() -> UploadFile:
    return UploadFile(file=io.BytesIO(PNG), filename="sheet.png")


class OmrOffLoopTests(unittest.TestCase):
    def setUp(self):
        for target, value in (("OMREvaluator", _SlowEvaluator), ("_teacher_student_roster", lambda *a: [{"id": "1"}])):
            patcher = mock.patch.object(service, target, value)
            patcher.start()
            self.addCleanup(patcher.stop)
        # One semaphore per test: each asyncio.run has its own event loop.
        patcher = mock.patch.object(service, "_MARKING_AT_ONCE", asyncio.Semaphore(2))
        patcher.start()
        self.addCleanup(patcher.stop)
        _SlowEvaluator.most_at_once = 0

    def _evaluate(self):
        return service.evaluate_omr_upload(mock.Mock(), mock.Mock(), _upload(), uuid.uuid4(), 50.0)

    def test_event_loop_keeps_running_while_a_sheet_is_marked(self):
        async def scenario():
            task = asyncio.create_task(self._evaluate())
            ticks = 0
            while not task.done():
                await asyncio.sleep(0.01)
                ticks += 1
            return ticks, task.result()

        ticks, response = asyncio.run(scenario())
        self.assertGreater(ticks, 10, "the loop was blocked while marking")
        self.assertEqual(response, {"max_marks": 50.0, "roster": [{"id": "1"}]})

    def test_only_a_few_sheets_are_marked_at_once(self):
        async def scenario():
            await asyncio.gather(*(self._evaluate() for _ in range(6)))

        asyncio.run(scenario())
        self.assertEqual(_SlowEvaluator.most_at_once, 2)

    def test_unreadable_sheet_is_still_a_400(self):
        class Unreadable(_SlowEvaluator):
            def load_image_from_bytes(self, content, filename):
                raise ValueError("too many pages")

        with mock.patch.object(service, "OMREvaluator", Unreadable):
            with self.assertRaises(HTTPException) as caught:
                asyncio.run(self._evaluate())
        self.assertEqual(caught.exception.status_code, 400)
        self.assertIn("too many pages", caught.exception.detail)


class OmrSafetyTests(unittest.TestCase):
    def test_pdf_rendering_never_overlaps(self):
        """PyMuPDF does not support multithreading."""
        from backend.omr import evaluator

        active, most = 0, 0
        lock = threading.Lock()

        class Document:
            page_count = 0

            def __iter__(self):
                nonlocal active
                time.sleep(0.05)
                with lock:
                    active -= 1
                return iter(())

            def close(self):
                pass

        def opening(**_kwargs):
            nonlocal active, most
            with lock:
                active += 1
                most = max(most, active)
            return Document()

        with mock.patch.object(evaluator.pymupdf, "open", opening):
            sheet = evaluator.OMREvaluator()
            threads = [threading.Thread(target=sheet.load_image_from_bytes, args=(b"x", "a.pdf")) for _ in range(4)]
            for thread in threads:
                thread.start()
            for thread in threads:
                thread.join()
        self.assertEqual(most, 1)

    def test_a_pdf_is_closed_inside_the_lock_even_when_rejected(self):
        from backend.omr import evaluator

        closed_locked = []

        class TooLong:
            page_count = 99

            def close(self):
                closed_locked.append(evaluator._PDF_LOCK.locked())

        with mock.patch.object(evaluator.pymupdf, "open", lambda **_: TooLong()):
            with self.assertRaises(ValueError):
                evaluator.OMREvaluator().load_image_from_bytes(b"x", "a.pdf")
        self.assertEqual(closed_locked, [True])

    def test_real_pdfs_render_correctly_from_many_threads(self):
        import pymupdf

        from backend.omr import evaluator

        made = pymupdf.open()
        made.new_page(width=200, height=300)
        pdf = made.tobytes()
        made.close()
        shapes, errors = [], []

        def render():
            try:
                for _ in range(5):
                    shapes.append(evaluator.OMREvaluator().load_image_from_bytes(pdf, "a.pdf")[0].shape[:2])
            except Exception as exc:
                errors.append(exc)

        threads = [threading.Thread(target=render) for _ in range(8)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
        self.assertEqual(errors, [])
        self.assertEqual(set(shapes), {(1250, 834)})
        self.assertEqual(len(shapes), 40)

    def _evaluate(self):
        return service.evaluate_omr_upload(mock.Mock(), mock.Mock(), _upload(), uuid.uuid4(), 50.0)

    def _patched(self):
        patches = [mock.patch.object(service, "OMREvaluator", _SlowEvaluator),
                   mock.patch.object(service, "_teacher_student_roster", lambda *a: []),
                   mock.patch.object(service, "_MARKING_AT_ONCE", asyncio.Semaphore(1))]
        for patcher in patches:
            patcher.start()
            self.addCleanup(patcher.stop)

    def test_a_full_queue_answers_busy(self):
        self._patched()

        async def scenario():
            with mock.patch.object(service, "_MARKING_MAX_WAITING", 1):
                return await asyncio.gather(*(self._evaluate() for _ in range(4)), return_exceptions=True)

        results = asyncio.run(scenario())
        busy = [r for r in results if isinstance(r, HTTPException) and r.status_code == 503]
        self.assertTrue(busy, results)
        self.assertEqual(busy[0].headers["Retry-After"], "10")
        self.assertTrue([r for r in results if isinstance(r, dict)], "some sheets should still be marked")
        self.assertEqual(service._marking_waiting, 0)

    def test_waiting_too_long_answers_busy_and_gives_nothing_up(self):
        self._patched()

        async def scenario():
            with mock.patch.object(service, "_MARKING_WAIT_SECONDS", 0.01):
                results = await asyncio.gather(self._evaluate(), self._evaluate(), return_exceptions=True)
            self.assertEqual(service._MARKING_AT_ONCE._value, 1)
            return results

        results = asyncio.run(scenario())
        self.assertEqual(sorted(type(r).__name__ for r in results), ["HTTPException", "dict"])


if __name__ == "__main__":
    unittest.main()
