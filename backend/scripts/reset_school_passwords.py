"""
One-off ops script: reset login passwords for every approved, active
principal/teacher at a given school to an easy-to-remember convention:

    Medha@<3-letter school code><4 random digits>

e.g. Medha@PNA4821

By default this is a DRY RUN -- it only prints the school match and the
accounts it *would* change, with their new passwords, and writes nothing.
Pass --apply to actually update the database.

Run from the backend/ directory so it picks up backend/.env (whatever
DATABASE_URL your environment is pointed at -- this is production unless
you've overridden it locally):

    cd backend
    uv run python scripts/reset_school_passwords.py --search "anglo"
    uv run python scripts/reset_school_passwords.py --search "anglo" --apply

If more than one school matches --search, nothing is written and all
matches are printed so you can narrow the search or pass --school-id
directly.
"""

import argparse
import random
import sys
import uuid

sys.path.insert(0, "src")

from sqlalchemy import create_engine, text  # noqa: E402

from backend.auth.hashing import hash_password  # noqa: E402
from backend.core.config import get_settings  # noqa: E402


def derive_code(school_name: str) -> str:
    """First letters of up to 3 significant words, uppercased. e.g.
    'P.N. Anglo School' -> 'PAS' -- always double-check this against what the
    school actually wants, this is just a reasonable default."""
    words = [w.strip(".") for w in school_name.split() if w.strip(".")]
    skip = {"school", "the", "of", "a", "an"}
    significant = [w for w in words if w.lower() not in skip] or words
    letters = "".join(w[0] for w in significant[:3]).upper()
    return (letters + "XXX")[:3]


def gen_password(code: str, used: set[str]) -> str:
    while True:
        digits = f"{random.randint(0, 9999):04d}"
        pw = f"Medha@{code}{digits}"
        if pw not in used:
            used.add(pw)
            return pw


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--search", default="anglo", help="ILIKE match against schools.name")
    parser.add_argument("--school-id", default=None, help="exact school UUID, skips --search")
    parser.add_argument("--code", default=None, help="override the 3-letter school code")
    parser.add_argument("--apply", action="store_true", help="actually write the new passwords")
    args = parser.parse_args()

    settings = get_settings()
    url = settings.database_url
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
    engine = create_engine(url)

    with engine.connect() as conn:
        if args.school_id:
            schools = conn.execute(
                text("SELECT id, name FROM schools WHERE id = :sid"),
                {"sid": uuid.UUID(args.school_id)},
            ).fetchall()
        else:
            schools = conn.execute(
                text("SELECT id, name FROM schools WHERE name ILIKE :p"),
                {"p": f"%{args.search}%"},
            ).fetchall()

        if len(schools) == 0:
            print(f"No school matched search={args.search!r}. Nothing to do.")
            return
        if len(schools) > 1:
            print(f"Multiple schools matched search={args.search!r} -- narrow it down or pass --school-id:")
            for s in schools:
                print(f"  {s.id}  {s.name!r}")
            return

        school = schools[0]
        code = (args.code or derive_code(school.name)).upper()
        print(f"School: {school.name!r} ({school.id})")
        print(f"Code: {code!r}  (pass --code to override)")

        rows = conn.execute(
            text(
                "SELECT id, full_name, role, email, phone_number "
                "FROM teachers "
                "WHERE school_id = :sid AND role IN ('principal', 'teacher') "
                "  AND approval_status = 'approved' AND is_active = true "
                "ORDER BY role, full_name"
            ),
            {"sid": school.id},
        ).fetchall()

        if not rows:
            print("No approved/active principal or teacher accounts at this school. Nothing to do.")
            return

        used: set[str] = set()
        plan = []
        for r in rows:
            pw = gen_password(code, used)
            plan.append((r, pw))

        print(f"\n{'APPLYING' if args.apply else 'DRY RUN -- pass --apply to write these'}:\n")
        print(f"{'role':10s} {'name':30s} {'login (email/phone)':30s} new password")
        for r, pw in plan:
            login = r.email or r.phone_number or "(no login identifier!)"
            print(f"{r.role:10s} {r.full_name:30s} {login:30s} {pw}")

        if not args.apply:
            print("\nNo changes written. Re-run with --apply to update the database.")
            return

        for r, pw in plan:
            conn.execute(
                text("UPDATE teachers SET password_hash = :h, updated_at = now() WHERE id = :id"),
                {"h": hash_password(pw), "id": r.id},
            )
        conn.commit()
        print(f"\nUpdated {len(plan)} account(s). Share each person's new password with them directly.")


if __name__ == "__main__":
    main()
