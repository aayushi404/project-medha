"""Seed the system admin account. Admins are never self-registered.

The admin has no school and is created already `approved`. The password is
read from ADMIN_PASSWORD; if unset, a strong one is generated and printed
once -- copy it, then change it on first login. Nothing secret is committed.

Idempotent: re-running only ensures the row exists (it never rewrites an
existing admin's password).

Usage:
    uv run python scripts/seed_admin.py
    ADMIN_EMAIL=admin@yourdomain.org ADMIN_PASSWORD='...' uv run python scripts/seed_admin.py
"""
import os
import secrets
from datetime import datetime, timezone

from backend.auth.hashing import hash_password
from backend.db.models import Teacher
from backend.db.session import SessionLocal, engine


def main() -> None:
    # `.local` is a reserved TLD that fails RFC email validation -- use a real
    # domain here and override with ADMIN_EMAIL for anything beyond local dev.
    email = os.environ.get("ADMIN_EMAIL", "admin@medha.app").strip().lower()
    password = os.environ.get("ADMIN_PASSWORD") or secrets.token_urlsafe(12)
    generated = "ADMIN_PASSWORD" not in os.environ

    print(f"target database: {engine.url.render_as_string(hide_password=True)}")
    db = SessionLocal()
    try:
        existing = db.query(Teacher).filter(Teacher.email == email).one_or_none()
        if existing is not None:
            print(f"exists   admin      {email} (role={existing.role}) -- unchanged")
            return

        db.add(
            Teacher(
                full_name="System Admin",
                email=email,
                password_hash=hash_password(password),
                role="admin",
                approval_status="approved",
                school_id=None,
                onboarded_at=datetime.now(timezone.utc),
            )
        )
        db.commit()
        print(f"created  admin      {email}")
        if generated:
            print(f"\n  generated password: {password}\n  Change it on first login.\n")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
