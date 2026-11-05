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


if __name__ == "__main__":
    unittest.main()
