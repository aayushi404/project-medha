"""Input validators shared by the auth/registration schemas. The backend is
authoritative -- the frontend repeats these rules only for faster feedback."""

import re
import unicodedata

_FORBIDDEN_NAME_CHARS = set('<>{}[]\\/;`"|=@#$%^*~')
_EMPLOYEE_CODE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9\-_/]{2,59}$")


def _no_control(v: str) -> None:
    if any(unicodedata.category(c).startswith("C") for c in v):
        raise ValueError("Contains invalid characters.")


def clean_name(v: str, *, label: str = "Name", max_len: int = 120) -> str:
    v = " ".join(v.split())  # trims and collapses runs of whitespace
    if len(v) < 2:
        raise ValueError(f"{label} is too short.")
    if len(v) > max_len:
        raise ValueError(f"{label} is too long.")
    _no_control(v)
    if any(c in _FORBIDDEN_NAME_CHARS for c in v):
        raise ValueError(f"{label} contains invalid characters.")
    if sum(c.isalpha() for c in v) < 2:
        raise ValueError(f"{label} must contain letters.")
    return v


def clean_text(v: str, *, max_len: int) -> str:
    v = v.strip()
    _no_control(v)
    if len(v) > max_len:
        raise ValueError("Too long.")
    return v


def employee_code(v: str) -> str:
    v = v.strip()
    if not _EMPLOYEE_CODE.match(v):
        raise ValueError("Employee code may contain only letters, digits, - _ / (3-60 characters).")
    return v


def indian_mobile(v: str) -> str:
    """Return the bare 10 digits of an Indian mobile number (first digit 6-9),
    accepting +91 / 0 prefixes, spaces and dashes."""
    digits = re.sub(r"\D", "", v)
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    if not re.fullmatch(r"[6-9]\d{9}", digits):
        raise ValueError("Enter a valid 10-digit Indian mobile number.")
    return digits


def e164_indian_mobile(v: str) -> str:
    return "+91" + indian_mobile(v)
