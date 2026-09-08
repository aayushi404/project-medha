"""Seed a spread of Bihar government schools (with districts + blocks) so the
registration school-search has realistic data to return.

Idempotent: districts match on (name, state), blocks on (district_id, name),
schools on their generated UDISE code. Safe to re-run and safe against a
database that already has the Phase 0 test school.

Usage:
    uv run python scripts/seed_schools.py
    DATABASE_URL=<url> uv run python scripts/seed_schools.py
"""

from sqlalchemy.orm import Session

from backend.db.models import Block, District, School
from backend.db.session import SessionLocal, engine

STATE = "Bihar"

# (district, [(block, [locality, ...]), ...])
DISTRICTS: list[tuple[str, list[tuple[str, list[str]]]]] = [
    ("Patna", [
        ("Patna Sadar", ["Kankarbagh", "Bakerganj", "Gardanibagh", "Kadamkuan"]),
        ("Danapur", ["Khagaul", "Nasriganj", "Danapur Cantt", "Saguna More"]),
    ]),
    ("Gaya", [
        ("Gaya Town", ["Manpur", "Chandauti", "Delha", "Buniyadganj"]),
        ("Bodh Gaya", ["Bakraur", "Pachatti", "Dumariya", "Mocharim"]),
    ]),
    ("Muzaffarpur", [
        ("Mushahari", ["Ramna", "Bela", "Ahiyapur", "Rohua"]),
        ("Kanti", ["Chakia More", "Panapur", "Rupauli", "Sahebganj"]),
    ]),
    ("Bhagalpur", [
        ("Nathnagar", ["Champanagar", "Habibpur", "Lodipur", "Barari"]),
        ("Sabour", ["Ghoghi", "Farka", "Rannuchak", "Ompur"]),
    ]),
    ("Nalanda", [
        ("Bihar Sharif", ["Sohsarai", "Pawapuri", "Kagol", "Ranchi More"]),
        ("Rajgir", ["Silao", "Nekpur", "Bargaon", "Giryek"]),
    ]),
    ("Darbhanga", [
        ("Darbhanga Sadar", ["Laheriasarai", "Donar", "Bahadurpur", "Mabbi"]),
        ("Benipur", ["Jhagrua", "Alinagar", "Rasiyari", "Sakri"]),
    ]),
    ("Purnia", [
        ("Purnia East", ["Rambagh", "Madhubani", "Kasba Road", "Gulabbagh"]),
        ("Kasba", ["Bishnupur", "Chandrahi", "Saur", "Mahesh Tola"]),
    ]),
    ("Begusarai", [
        ("Begusarai Sadar", ["Lohiyanagar", "Ulao", "Barauni", "Ratanpur"]),
        ("Teghra", ["Refinery Colony", "Phaphaut", "Sadikpur", "Nirpur"]),
    ]),
    ("Saran", [
        ("Chhapra Sadar", ["Salempur", "Daudpur", "Rasulpur", "Bhikhari Thakur Nagar"]),
        ("Marhaura", ["Dighwara", "Amnour", "Ekma", "Baniapur"]),
    ]),
    ("Rohtas", [
        ("Sasaram", ["Shivsagar", "Dehri", "Karma", "Tilouthu"]),
        ("Bikramganj", ["Nasriganj", "Dinara", "Nokha", "Rajpur"]),
    ]),
    ("Vaishali", [
        ("Hajipur", ["Jadhua", "Industrial Area", "Ramashish Chowk", "Digha Ghat"]),
        ("Mahnar", ["Lalganj", "Bidupur", "Raghopur", "Jandaha"]),
    ]),
    ("Samastipur", [
        ("Samastipur Sadar", ["Mohanpur", "Kashipur", "Patori", "Ujiyarpur"]),
        ("Rosera", ["Singhia", "Warisnagar", "Hasanpur", "Bibhutipur"]),
    ]),
]

# (name template, school_type, medium) -- rotated per locality
TEMPLATES: list[tuple[str, str, str]] = [
    ("Rajkiya Prathmik Vidyalaya, {p}", "primary", "Hindi"),
    ("Rajkiya Madhya Vidyalaya, {p}", "middle", "Hindi"),
    ("Utkramit Madhya Vidyalaya, {p}", "middle", "Hindi"),
    ("Govt High School, {p}", "secondary", "Hindi"),
    ("Govt Girls High School, {p}", "secondary", "Hindi"),
    ("Govt +2 High School, {p}", "senior_secondary", "Hindi & English"),
    ("Kasturba Gandhi Balika Vidyalaya, {p}", "residential", "Hindi"),
    ("Project Balika Uchch Vidyalaya, {p}", "secondary", "Hindi"),
]


def get_or_create(db: Session, model, defaults: dict | None = None, **lookup):
    instance = db.query(model).filter_by(**lookup).one_or_none()
    if instance is not None:
        return instance, False
    instance = model(**lookup, **(defaults or {}))
    db.add(instance)
    db.flush()
    return instance, True


def seed(db: Session) -> None:
    made_d = made_b = made_s = 0

    for di, (district_name, blocks) in enumerate(DISTRICTS, start=1):
        district, created = get_or_create(
            db, District, name=district_name, state=STATE
        )
        made_d += created
        if created:
            print(f"  + district  {district_name}")

        for bi, (block_name, localities) in enumerate(blocks, start=1):
            block, created = get_or_create(
                db, Block, district_id=district.id, name=block_name
            )
            made_b += created
            if created:
                print(f"    + block   {district_name} / {block_name}")

            for si, locality in enumerate(localities, start=1):
                # advance the template across districts/blocks/localities so the
                # full spread of school types shows up, not just the first four
                idx = (di - 1 + (bi - 1) * len(localities) + (si - 1)) % len(TEMPLATES)
                tmpl, school_type, medium = TEMPLATES[idx]
                name = tmpl.format(p=locality)
                udise = f"10{di:02d}{bi:02d}{si:05d}"  # 11 digits, state 10 = Bihar

                school = (
                    db.query(School).filter(School.udise_code == udise).one_or_none()
                )
                if school is None:
                    db.add(
                        School(
                            udise_code=udise,
                            name=name,
                            district_id=district.id,
                            block_id=block.id,
                            school_type=school_type,
                            medium_of_instruction=medium,
                        )
                    )
                    made_s += 1
                    print(f"      + school  [{udise}] {name}")
                else:
                    # keep the seeded fields in sync on re-run
                    school.name = name
                    school.district_id = district.id
                    school.block_id = block.id
                    school.school_type = school_type
                    school.medium_of_instruction = medium

    total_s = db.query(School).count()
    print(
        f"\nnew: {made_d} districts, {made_b} blocks, {made_s} schools   "
        f"(db now: {db.query(District).count()} districts, "
        f"{db.query(Block).count()} blocks, {total_s} schools)"
    )


def main() -> None:
    print(f"target database: {engine.url.render_as_string(hide_password=True)}")
    db = SessionLocal()
    try:
        seed(db)
        db.commit()
        print("committed.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
