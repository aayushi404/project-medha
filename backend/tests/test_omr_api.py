import os
import sys
import uuid
import cv2
import unittest
from fastapi.testclient import TestClient

# Ensure src is on python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))

from backend.app import app
from backend.auth.service import create_access_token
from backend.db.session import SessionLocal
from backend.db.models import Teacher, Grade
from backend.omr.evaluator import OMREvaluator
from backend.omr.template import (
    ROW0_Y_HUNDREDS, ROW0_Y_TENS, ROW0_Y_UNITS,
    ROW_Y_OFFSET_STEP, DIGIT_X_CENTERS
)

client = TestClient(app)

def generate_marked_omr_bytes():
    pdf_path = "/home/aayushi/projects/ai/shiksha_sathi/OMR_Evaluation_Sheet_A4.pdf"
    evaluator = OMREvaluator()
    with open(pdf_path, "rb") as f:
        images = evaluator.load_image_from_bytes(f.read(), "OMR_Evaluation_Sheet_A4.pdf")

    img = images[0]
    src_pts = evaluator.detect_registration_markers(img)
    warped = evaluator.perspective_transform(img, src_pts)

    def mark_warped_bubble(warped_img, student_idx, place, digit):
        y_base = ROW0_Y_HUNDREDS if place == "hundreds" else ROW0_Y_TENS if place == "tens" else ROW0_Y_UNITS
        y_pt = y_base + student_idx * ROW_Y_OFFSET_STEP
        x_pt = DIGIT_X_CENTERS[digit]

        cx = int(round(x_pt * evaluator.scale_x))
        cy = int(round(y_pt * evaluator.scale_y))
        r = int(round(5.0 * evaluator.scale_x))
        cv2.circle(warped_img, (cx, cy), r, (0, 0, 0), -1)

    # Roll 1 -> 85
    mark_warped_bubble(warped, 0, "hundreds", 0)
    mark_warped_bubble(warped, 0, "tens", 8)
    mark_warped_bubble(warped, 0, "units", 5)

    # Roll 2 -> 76
    mark_warped_bubble(warped, 1, "hundreds", 0)
    mark_warped_bubble(warped, 1, "tens", 7)
    mark_warped_bubble(warped, 1, "units", 6)

    is_success, buffer = cv2.imencode(".png", warped)
    assert is_success
    return buffer.tobytes()


class TestOMRAPI(unittest.TestCase):

    def test_omr_evaluate_unauthorized(self):
        """Test that requests without auth token return 401."""
        response = client.post("/report-card/omr/evaluate?grade_id=" + str(uuid.uuid4()))
        self.assertEqual(response.status_code, 401)

    def test_omr_evaluate_missing_grade_id(self):
        """Test that requests missing grade_id return 422 validation error."""
        db = SessionLocal()
        teacher = db.query(Teacher).filter(Teacher.email == "rajesh.maths@medhabihar.org").first()
        if not teacher:
            teacher = db.query(Teacher).first()
        db.close()
        self.assertIsNotNone(teacher, "Seed teacher expected in DB")

        token = create_access_token(teacher.id)
        headers = {"Authorization": f"Bearer {token}"}

        response = client.post("/report-card/omr/evaluate", headers=headers)
        self.assertEqual(response.status_code, 422)

    def test_omr_evaluate_valid_sheet(self):
        """Test full OMR evaluation API returning structured StudentOMRResult objects."""
        db = SessionLocal()
        teacher = db.query(Teacher).filter(Teacher.email == "rajesh.maths@medhabihar.org").first()
        if not teacher:
            teacher = db.query(Teacher).first()
        grade = db.query(Grade).filter(Grade.label == "Class 6").first()
        if not grade:
            grade = db.query(Grade).first()
        db.close()

        self.assertIsNotNone(teacher)
        self.assertIsNotNone(grade)

        token = create_access_token(teacher.id)
        headers = {"Authorization": f"Bearer {token}"}

        image_bytes = generate_marked_omr_bytes()

        files = {"file": ("marked_omr.png", image_bytes, "image/png")}
        params = {"grade_id": str(grade.id), "max_marks": 100.0}

        response = client.post("/report-card/omr/evaluate", headers=headers, files=files, params=params)
        self.assertEqual(response.status_code, 200, f"Error: {response.text}")

        data = response.json()
        self.assertTrue(data["processed"])
        self.assertIn("summary", data)
        self.assertEqual(data["summary"]["total_rows"], 7)
        self.assertEqual(len(data["results"]), 7)

        # Check Roll 1 evaluation: 85 marks
        roll_1 = next(r for r in data["results"] if r["roll_number"] == 1)
        self.assertEqual(roll_1["detected_marks"], 85.0)
        self.assertEqual(roll_1["status"], "valid")

        # Check Roll 2 evaluation: 76 marks
        roll_2 = next(r for r in data["results"] if r["roll_number"] == 2)
        self.assertEqual(roll_2["detected_marks"], 76.0)
        self.assertEqual(roll_2["status"], "valid")


if __name__ == "__main__":
    unittest.main()

