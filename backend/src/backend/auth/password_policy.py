"""Password rules shared by registration, reset and change. Length is counted
in UTF-8 bytes because bcrypt only reads the first 72 -- a longer password
would silently be truncated, so it is rejected instead."""

import re

MIN_LENGTH = 10
MAX_BYTES = 72

# Small built-in list of the most common passwords (lower-cased); not a
# substitute for a breached-password service, but it removes the worst picks.
_COMMON = {
    "password", "password1", "password12", "password123", "password1234", "passw0rd", "p@ssw0rd",
    "12345678", "123456789", "1234567890", "123123123", "1q2w3e4r5t", "qwertyuiop", "qwerty123",
    "qwertyui", "iloveyou1", "abc12345", "abcd1234", "admin123", "admin1234", "welcome123",
    "letmein123", "changeme123", "india12345", "india@123", "bihar@123", "bihar12345", "school123",
    "school@123", "teacher123", "student123", "principal123", "medha123", "medha@123",
    "111111111", "000000000", "9876543210", "0123456789",
}


def validate_password(password: str, *, email: str | None = None, name: str | None = None) -> str:
    """Return the password if acceptable, otherwise raise ValueError with a
    message safe to show to the user."""
    if len(password) < MIN_LENGTH:
        raise ValueError(f"Password must be at least {MIN_LENGTH} characters.")
    if len(password.encode("utf-8")) > MAX_BYTES:
        raise ValueError(f"Password is too long (max {MAX_BYTES} bytes).")
    lowered = password.lower()
    if lowered in _COMMON or len(set(lowered)) < 4:
        raise ValueError("That password is too common. Choose something harder to guess.")
    if not (any(c.isalpha() for c in password) and any(c.isdigit() or not c.isalnum() for c in password)):
        raise ValueError("Password must mix letters with at least one number or symbol.")
    squashed = re.sub(r"[^a-z0-9]", "", lowered)  # ignore separators: "kiran-devi" ~ "kirandevi"
    if email:
        local = re.sub(r"[^a-z0-9]", "", email.split("@")[0].lower())
        if len(local) >= 4 and local in squashed:
            raise ValueError("Password must not contain your email address.")
    if name:
        for part in name.lower().split():
            if len(part) >= 4 and part in squashed:
                raise ValueError("Password must not contain your name.")
    return password
