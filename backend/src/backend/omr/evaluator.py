import cv2
import numpy as np
import pymupdf

from backend.omr.schemas import (
    BubbleScore,
    DigitEvaluation,
    OMREvaluationResponse,
    OMRPipelineSummary,
    StudentOMRResult,
)
from backend.omr.template import (
    BUBBLE_OUTER_RADIUS,
    CANONICAL_HEIGHT,
    CANONICAL_WIDTH,
    INNER_MASK_FACTOR,
    MARKER_BL,
    MARKER_BR,
    MARKER_TL,
    MARKER_TR,
    ROW0_Y_HUNDREDS,
    ROW0_Y_TENS,
    ROW0_Y_UNITS,
    ROW_Y_OFFSET_STEP,
    STUDENT_ROWS_COUNT,
    DIGIT_X_CENTERS,
)

# Threshold settings for bubble fill detection
FILLED_THRESHOLD = 0.30  # Fill ratio > 30% considered filled
EMPTY_THRESHOLD = 0.15   # Fill ratio < 15% considered empty


class OMREvaluator:
    def __init__(self, target_width: int = 1190, target_height: int = 1684):
        self.target_w = target_width
        self.target_h = target_height
        self.scale_x = target_width / CANONICAL_WIDTH
        self.scale_y = target_height / CANONICAL_HEIGHT

    def load_image_from_bytes(self, file_bytes: bytes, filename: str) -> list[np.ndarray]:
        """Loads PDF pages or image files into list of BGR numpy arrays."""
        filename_lower = filename.lower()
        if filename_lower.endswith(".pdf"):
            doc = pymupdf.open(stream=file_bytes, filetype="pdf")
            images = []
            for page in doc:
                zoom = 300 / 72  # 300 DPI rendering
                mat = pymupdf.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat)
                img_data = np.frombuffer(pix.tobytes("png"), dtype=np.uint8)
                bgr = cv2.imdecode(img_data, cv2.IMREAD_COLOR)
                images.append(bgr)
            return images
        else:
            nparr = np.frombuffer(file_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                raise ValueError("Could not decode image file.")
            return [img]

    def detect_registration_markers(self, img: np.ndarray) -> np.ndarray:
        """Detects the 4 black corner registration squares.

        Returns 4x2 float32 array of coordinates [TL, TR, BR, BL].
        Raises ValueError if markers cannot be detected.
        """
        h, w = img.shape[:2]
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blur = cv2.GaussianBlur(gray, (5, 5), 0)
        _, thresh = cv2.threshold(blur, 100, 255, cv2.THRESH_BINARY_INV)

        contours, _ = cv2.findContours(thresh, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

        # Expected canonical marker points
        c_tl = (MARKER_TL[0] * w / CANONICAL_WIDTH, MARKER_TL[1] * h / CANONICAL_HEIGHT)
        c_tr = (MARKER_TR[0] * w / CANONICAL_WIDTH, MARKER_TR[1] * h / CANONICAL_HEIGHT)
        c_bl = (MARKER_BL[0] * w / CANONICAL_WIDTH, MARKER_BL[1] * h / CANONICAL_HEIGHT)
        c_br = (MARKER_BR[0] * w / CANONICAL_WIDTH, MARKER_BR[1] * h / CANONICAL_HEIGHT)

        quadrants = {"TL": (c_tl, None, 999999), "TR": (c_tr, None, 999999), "BL": (c_bl, None, 999999), "BR": (c_br, None, 999999)}

        img_area = w * h
        min_marker_area = img_area * 0.00005
        max_marker_area = img_area * 0.02

        for cnt in contours:
            area = cv2.contourArea(cnt)
            if min_marker_area <= area <= max_marker_area:
                bx, by, bw, bh = cv2.boundingRect(cnt)
                aspect = float(bw) / bh
                extent = float(area) / (bw * bh)
                if 0.70 <= aspect <= 1.30 and extent >= 0.65:
                    mcx = bx + bw / 2.0
                    mcy = by + bh / 2.0

                    # Match to closest corner quadrant
                    for key, (exp_pt, best_pt, best_dist) in list(quadrants.items()):
                        dist = (mcx - exp_pt[0]) ** 2 + (mcy - exp_pt[1]) ** 2
                        if dist < best_dist and dist < (w * 0.2) ** 2:
                            quadrants[key] = (exp_pt, (mcx, mcy), dist)

        pts = []
        for key in ["TL", "TR", "BR", "BL"]:
            _, best_pt, _ = quadrants[key]
            if best_pt is None:
                # If exact marker contour not found, fallback to ratio estimation if near page boundary
                if key == "TL":
                    pts.append([MARKER_TL[0] * w / CANONICAL_WIDTH, MARKER_TL[1] * h / CANONICAL_HEIGHT])
                elif key == "TR":
                    pts.append([MARKER_TR[0] * w / CANONICAL_WIDTH, MARKER_TR[1] * h / CANONICAL_HEIGHT])
                elif key == "BR":
                    pts.append([MARKER_BR[0] * w / CANONICAL_WIDTH, MARKER_BR[1] * h / CANONICAL_HEIGHT])
                elif key == "BL":
                    pts.append([MARKER_BL[0] * w / CANONICAL_WIDTH, MARKER_BL[1] * h / CANONICAL_HEIGHT])
            else:
                pts.append(list(best_pt))

        return np.array(pts, dtype=np.float32)

    def perspective_transform(self, img: np.ndarray, src_pts: np.ndarray) -> np.ndarray:
        """Warps document image into target canonical dimensions."""
        dst_pts = np.array(
            [
                [MARKER_TL[0] * self.scale_x, MARKER_TL[1] * self.scale_y],
                [MARKER_TR[0] * self.scale_x, MARKER_TR[1] * self.scale_y],
                [MARKER_BR[0] * self.scale_x, MARKER_BR[1] * self.scale_y],
                [MARKER_BL[0] * self.scale_x, MARKER_BL[1] * self.scale_y],
            ],
            dtype=np.float32,
        )

        M = cv2.getPerspectiveTransform(src_pts, dst_pts)
        warped = cv2.warpPerspective(img, M, (self.target_w, self.target_h))
        return warped

    def evaluate_bubble_fill(self, gray_img: np.ndarray, cx_pt: float, cy_pt: float) -> float:
        """Measures inner circular fill ratio for a single bubble."""
        cx = int(round(cx_pt * self.scale_x))
        cy = int(round(cy_pt * self.scale_y))
        r = int(round(BUBBLE_OUTER_RADIUS * INNER_MASK_FACTOR * self.scale_x))

        if cx - r < 0 or cx + r >= self.target_w or cy - r < 0 or cy + r >= self.target_h:
            return 0.0

        roi = gray_img[cy - r : cy + r + 1, cx - r : cx + r + 1]
        if roi.size == 0:
            return 0.0

        # Create circular mask
        mask = np.zeros(roi.shape, dtype=np.uint8)
        cv2.circle(mask, (r, r), r, 255, -1)

        # Threshold dark pixels inside circle
        # Otsu threshold or static threshold
        _, thresh = cv2.threshold(roi, 140, 255, cv2.THRESH_BINARY_INV)
        dark_pixels = cv2.bitwise_and(thresh, thresh, mask=mask)

        fill_ratio = float(np.count_nonzero(dark_pixels)) / float(np.count_nonzero(mask) or 1)
        return fill_ratio

    def evaluate_digit_row(self, gray_img: np.ndarray, y_center_pt: float, place_name: str) -> DigitEvaluation:
        """Evaluates 10 bubbles (digits 0..9) along a digit row."""
        scores = []
        filled_digits = []

        for digit, x_pt in enumerate(DIGIT_X_CENTERS):
            ratio = self.evaluate_bubble_fill(gray_img, x_pt, y_center_pt)
            is_filled = ratio >= FILLED_THRESHOLD
            scores.append(BubbleScore(digit=digit, fill_ratio=round(ratio, 4), is_filled=is_filled))
            if is_filled:
                filled_digits.append((digit, ratio))

        if len(filled_digits) == 1:
            selected_digit = filled_digits[0][0]
            confidence = min(1.0, round(filled_digits[0][1] / 0.80, 2))
            status = "valid"
        elif len(filled_digits) > 1:
            # Pick darkest digit as candidate, but mark status ambiguous
            filled_digits.sort(key=lambda x: x[1], reverse=True)
            selected_digit = filled_digits[0][0]
            confidence = 0.50
            status = "ambiguous"
        else:
            selected_digit = None
            confidence = 0.0
            status = "missing"

        return DigitEvaluation(
            place=place_name,
            selected_digit=selected_digit,
            confidence=confidence,
            status=status,
            scores=scores,
        )

    def evaluate_sheet(
        self, img: np.ndarray, max_marks: float = 100.0, student_roster: list | None = None
    ) -> OMREvaluationResponse:
        """Runs the complete OMR evaluation pipeline on an image."""
        src_pts = self.detect_registration_markers(img)
        warped = self.perspective_transform(img, src_pts)
        gray_warped = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)

        results = []
        valid_count = 0
        needs_review_count = 0
        missing_count = 0

        for idx in range(STUDENT_ROWS_COUNT):
            roll_no = idx + 1
            y_h = ROW0_Y_HUNDREDS + idx * ROW_Y_OFFSET_STEP
            y_t = ROW0_Y_TENS + idx * ROW_Y_OFFSET_STEP
            y_u = ROW0_Y_UNITS + idx * ROW_Y_OFFSET_STEP

            eval_h = self.evaluate_digit_row(gray_warped, y_h, "hundreds")
            eval_t = self.evaluate_digit_row(gray_warped, y_t, "tens")
            eval_u = self.evaluate_digit_row(gray_warped, y_u, "units")

            issues = []
            status = "valid"

            # Check digit status
            if eval_h.status == "ambiguous" or eval_t.status == "ambiguous" or eval_u.status == "ambiguous":
                status = "ambiguous"
                issues.append("Multiple bubbles marked in one or more digit rows.")
            elif eval_h.status == "missing" or eval_t.status == "missing" or eval_u.status == "missing":
                status = "missing"
                issues.append("Missing bubble mark in one or more digit rows.")

            # Compute detected marks if all digits present
            detected_marks = None
            if eval_h.selected_digit is not None and eval_t.selected_digit is not None and eval_u.selected_digit is not None:
                calc_marks = eval_h.selected_digit * 100 + eval_t.selected_digit * 10 + eval_u.selected_digit
                detected_marks = float(calc_marks)

                if detected_marks > max_marks:
                    status = "invalid_max"
                    issues.append(f"Detected marks ({calc_marks}) exceed maximum marks ({max_marks}).")

            # Match student name/id if roster provided
            st_id = None
            st_name = None
            if student_roster:
                match = next((s for s in student_roster if str(s.get("roll_number", "")).lstrip("0") == str(roll_no)), None)
                if match:
                    st_id = str(match.get("id"))
                    st_name = match.get("full_name")

            confidence = round((eval_h.confidence + eval_t.confidence + eval_u.confidence) / 3.0, 2)

            if status == "valid":
                valid_count += 1
            elif status == "missing":
                missing_count += 1
            else:
                needs_review_count += 1

            results.append(
                StudentOMRResult(
                    roll_number=roll_no,
                    student_id=st_id,
                    student_name=st_name,
                    hundreds=eval_h.selected_digit,
                    tens=eval_t.selected_digit,
                    units=eval_u.selected_digit,
                    detected_marks=detected_marks,
                    max_marks=max_marks,
                    status=status,
                    confidence=confidence,
                    issues=issues,
                    digit_evaluations={
                        "hundreds": eval_h,
                        "tens": eval_t,
                        "units": eval_u,
                    },
                )
            )

        summary = OMRPipelineSummary(
            total_rows=STUDENT_ROWS_COUNT,
            valid_count=valid_count,
            needs_review_count=needs_review_count,
            missing_count=missing_count,
        )

        return OMREvaluationResponse(
            processed=True,
            page_count=1,
            summary=summary,
            results=results,
            message=f"Evaluated 7 student rows. {valid_count} valid, {needs_review_count + missing_count} need review.",
        )
