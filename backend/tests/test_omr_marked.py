import os
import sys
import uuid
import cv2
import numpy as np
import unittest

# Ensure src is on python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))

from backend.omr.evaluator import OMREvaluator
from backend.omr.template import (
    CANONICAL_WIDTH,
    CANONICAL_HEIGHT,
    ROW0_Y_HUNDREDS,
    ROW0_Y_TENS,
    ROW0_Y_UNITS,
    ROW_Y_OFFSET_STEP,
    DIGIT_X_CENTERS,
)

PDF_PATH = "/home/aayushi/projects/ai/shiksha_sathi/OMR_Evaluation_Sheet_A4.pdf"


def mark_warped_bubble(warped_img, evaluator, student_idx, place, digit, fill_color=(0, 0, 0)):
    """Simulate pen mark inside a bubble on the canonical warped image space."""
    y_base = ROW0_Y_HUNDREDS if place == "hundreds" else ROW0_Y_TENS if place == "tens" else ROW0_Y_UNITS
    y_pt = y_base + student_idx * ROW_Y_OFFSET_STEP
    x_pt = DIGIT_X_CENTERS[digit]

    cx = int(round(x_pt * evaluator.scale_x))
    cy = int(round(y_pt * evaluator.scale_y))
    r = int(round(5.0 * evaluator.scale_x))

    cv2.circle(warped_img, (cx, cy), r, fill_color, -1)


class TestOMRMarkedPipeline(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.evaluator = OMREvaluator()
        with open(PDF_PATH, "rb") as f:
            pdf_bytes = f.read()
        images = cls.evaluator.load_image_from_bytes(pdf_bytes, "OMR_Evaluation_Sheet_A4.pdf")
        cls.base_image = images[0]

    def test_detection_and_warp_integrity(self):
        """Verify corner marker detection and homography warping on blank sheet."""
        src_pts = self.evaluator.detect_registration_markers(self.base_image)
        self.assertEqual(src_pts.shape, (4, 2))

        warped = self.evaluator.perspective_transform(self.base_image, src_pts)
        h, w = warped.shape[:2]
        self.assertGreater(h, 1000)
        self.assertGreater(w, 1000)

    def test_marked_sheet_evaluation_scenarios(self):
        """Test marked OMR sheet with valid, ambiguous, missing, and zero marks."""
        src_pts = self.evaluator.detect_registration_markers(self.base_image)
        warped = self.evaluator.perspective_transform(self.base_image, src_pts)

        # Roll 1 -> 085 (85 marks)
        mark_warped_bubble(warped, self.evaluator, 0, "hundreds", 0)
        mark_warped_bubble(warped, self.evaluator, 0, "tens", 8)
        mark_warped_bubble(warped, self.evaluator, 0, "units", 5)

        # Roll 2 -> 076 (76 marks)
        mark_warped_bubble(warped, self.evaluator, 1, "hundreds", 0)
        mark_warped_bubble(warped, self.evaluator, 1, "tens", 7)
        mark_warped_bubble(warped, self.evaluator, 1, "units", 6)

        # Roll 3 -> 091 (91 marks)
        mark_warped_bubble(warped, self.evaluator, 2, "hundreds", 0)
        mark_warped_bubble(warped, self.evaluator, 2, "tens", 9)
        mark_warped_bubble(warped, self.evaluator, 2, "units", 1)

        # Roll 4 -> 100 (100 marks)
        mark_warped_bubble(warped, self.evaluator, 3, "hundreds", 1)
        mark_warped_bubble(warped, self.evaluator, 3, "tens", 0)
        mark_warped_bubble(warped, self.evaluator, 3, "units", 0)

        # Roll 5 -> 000 (0 marks)
        mark_warped_bubble(warped, self.evaluator, 4, "hundreds", 0)
        mark_warped_bubble(warped, self.evaluator, 4, "tens", 0)
        mark_warped_bubble(warped, self.evaluator, 4, "units", 0)

        # Roll 6 -> Ambiguous (tens has 7 and 8 marked)
        mark_warped_bubble(warped, self.evaluator, 5, "hundreds", 0)
        mark_warped_bubble(warped, self.evaluator, 5, "tens", 7)
        mark_warped_bubble(warped, self.evaluator, 5, "tens", 8)
        mark_warped_bubble(warped, self.evaluator, 5, "units", 2)

        # Roll 7 -> Unmarked (missing)

        # Evaluate warped image directly
        response = self.evaluator.evaluate_sheet(warped, max_marks=100.0)

        self.assertTrue(response.processed)
        self.assertEqual(len(response.results), 7)

        # Assert Roll 1
        res1 = next(r for r in response.results if r.roll_number == 1)
        self.assertEqual(res1.detected_marks, 85.0)
        self.assertEqual(res1.status, "valid")

        # Assert Roll 2
        res2 = next(r for r in response.results if r.roll_number == 2)
        self.assertEqual(res2.detected_marks, 76.0)
        self.assertEqual(res2.status, "valid")

        # Assert Roll 3
        res3 = next(r for r in response.results if r.roll_number == 3)
        self.assertEqual(res3.detected_marks, 91.0)
        self.assertEqual(res3.status, "valid")

        # Assert Roll 4
        res4 = next(r for r in response.results if r.roll_number == 4)
        self.assertEqual(res4.detected_marks, 100.0)
        self.assertEqual(res4.status, "valid")

        # Assert Roll 5
        res5 = next(r for r in response.results if r.roll_number == 5)
        self.assertEqual(res5.detected_marks, 0.0)
        self.assertEqual(res5.status, "valid")

        # Assert Roll 6 (Ambiguous)
        res6 = next(r for r in response.results if r.roll_number == 6)
        self.assertEqual(res6.status, "ambiguous")
        self.assertIn("Multiple bubbles marked in one or more digit rows.", res6.issues)

        # Assert Roll 7 (Missing)
        res7 = next(r for r in response.results if r.roll_number == 7)
        self.assertEqual(res7.status, "missing")
        self.assertIsNone(res7.detected_marks)

    def test_exceeds_max_marks_validation(self):
        """Test that marks exceeding max_marks are correctly flagged."""
        src_pts = self.evaluator.detect_registration_markers(self.base_image)
        warped = self.evaluator.perspective_transform(self.base_image, src_pts)

        # Roll 1 -> 85 marks, but max_marks set to 50
        mark_warped_bubble(warped, self.evaluator, 0, "hundreds", 0)
        mark_warped_bubble(warped, self.evaluator, 0, "tens", 8)
        mark_warped_bubble(warped, self.evaluator, 0, "units", 5)

        response = self.evaluator.evaluate_sheet(warped, max_marks=50.0)
        res1 = next(r for r in response.results if r.roll_number == 1)

        self.assertEqual(res1.status, "invalid_max")
        self.assertEqual(res1.detected_marks, 85.0)
        self.assertTrue(any("exceed" in issue for issue in res1.issues))

    def test_rotated_sheet_perspective_correction(self):
        """Test corner marker detection & warping on a rotated image."""
        h, w = self.base_image.shape[:2]
        center = (w // 2, h // 2)
        # Rotate by 3 degrees
        rot_mat = cv2.getRotationMatrix2D(center, 3.0, 1.0)
        rotated = cv2.warpAffine(self.base_image, rot_mat, (w, h), borderValue=(255, 255, 255))

        src_pts = self.evaluator.detect_registration_markers(rotated)
        self.assertEqual(src_pts.shape, (4, 2))

        warped = self.evaluator.perspective_transform(rotated, src_pts)
        self.assertIsNotNone(warped)


if __name__ == "__main__":
    unittest.main()
