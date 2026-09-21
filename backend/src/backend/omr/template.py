"""Canonical OMR Template Configuration derived from OMR_Evaluation_Sheet_A4.pdf.

All dimensions and coordinates are in normalized points (A4 size: 595.28 x 841.89).
When evaluating warped images, coordinates are scaled to the warped image width and height.
"""

# Canonical document dimensions in A4 points
CANONICAL_WIDTH = 595.27557
CANONICAL_HEIGHT = 841.88977

# Corner registration markers (center coordinates in canonical A4 points)
MARKER_TL = (32.0, 158.0)
MARKER_TR = (563.27557, 158.0)
MARKER_BL = (32.0, 646.0)
MARKER_BR = (563.27557, 646.0)

# Expected marker rectangle size in canonical A4 points (square ~ 9x9 pt)
MARKER_SIZE = 9.0

# Student rows configuration
STUDENT_ROWS_COUNT = 7
ROW_Y_OFFSET_STEP = 66.0

# Base Y centers for Student Row 0 (Roll 1)
ROW0_Y_HUNDREDS = 195.0
ROW0_Y_TENS = 217.0
ROW0_Y_UNITS = 239.0

# X centers for digits 0 to 9
DIGIT_X_CENTERS = [
    181.8638,  # 0
    213.5913,  # 1
    245.3189,  # 2
    277.0465,  # 3
    308.7740,  # 4
    340.5016,  # 5
    372.2291,  # 6
    403.9567,  # 7
    435.6843,  # 8
    467.4118,  # 9
]

# Outer circle radius of OMR bubble in canonical A4 points
BUBBLE_OUTER_RADIUS = 7.2

# Inner sampling radius factor (excluding outer stroke/border line)
INNER_MASK_FACTOR = 0.65


def get_student_row_bubbles(student_idx: int) -> dict:
    """Returns bubble center coordinates for student_idx (0..6).

    Structure:
    {
        "rollNumber": student_idx + 1,
        "hundreds": [ (x0, y), (x1, y), ... ],
        "tens": [ (x0, y), ... ],
        "units": [ (x0, y), ... ]
    }
    """
    y_hundreds = ROW0_Y_HUNDREDS + student_idx * ROW_Y_OFFSET_STEP
    y_tens = ROW0_Y_TENS + student_idx * ROW_Y_OFFSET_STEP
    y_units = ROW0_Y_UNITS + student_idx * ROW_Y_OFFSET_STEP

    return {
        "rollNumber": student_idx + 1,
        "hundreds": [(x, y_hundreds) for x in DIGIT_X_CENTERS],
        "tens": [(x, y_tens) for x in DIGIT_X_CENTERS],
        "units": [(x, y_units) for x in DIGIT_X_CENTERS],
    }
