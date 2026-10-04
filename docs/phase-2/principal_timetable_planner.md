# Medha — Timetable Builder Architecture

Principal designs a weekly timetable: for each class section and period, a subject and a teacher. Part 2 (absence + substitution) is deliberately out of scope here, but the schema below is shaped so it drops in cleanly.

---

## 1. Three decisions that shape everything else

**The grid is periods × class sections, for one day.** Your sketch has this right. A teacher clash is "same teacher, same period, different section" — that's a comparison *across columns*, so all sections must be on screen together. A per-class view would hide the exact conflicts the feature exists to prevent.

**Period slots carry the day.** If `period_slots` is keyed by `(school, day_of_week, period_number)`, then a `period_slot_id` already encodes which day it is. Timetable entries then need no `day_of_week` column, and the uniqueness constraints get simpler and harder to get wrong. This also solves "Saturday has 4 periods, weekdays have 8" for free — Saturday simply has fewer slot rows.

**The no-double-booking rule belongs in the database, not just the UI.** Client-side checks are for feedback; they don't survive two browser tabs, a stale page, or a direct API call. One partial unique index makes the invariant impossible to violate regardless of what the client does.

---

## 2. Schema

```python
class PeriodSlot(Base):
    """A time slot in the school day. Keyed by day, so a school can run a
    different structure on Saturday without any special-casing."""

    __tablename__ = "period_slots"
    __table_args__ = (
        UniqueConstraint("school_id", "day_of_week", "period_number"),
        Index("idx_period_slots_school_day", "school_id", "day_of_week", "period_number"),
        CheckConstraint("day_of_week BETWEEN 1 AND 7", name="chk_slot_dow"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schools.id", ondelete="CASCADE")
    )
    day_of_week: Mapped[int]                 # 1 = Monday … 6 = Saturday
    period_number: Mapped[int]
    label: Mapped[str | None]                # "P1", "Assembly", "Lunch"
    starts_at: Mapped[time | None]
    ends_at: Mapped[time | None]
    # Breaks render as a full-width band and hold no entries.
    is_break: Mapped[bool] = mapped_column(server_default=text("false"))


class Timetable(Base):
    """A versioned timetable for one school + academic year. Versioning matters:
    schools revise mid-year, and part 2's substitution log must point at the
    timetable that was actually in force on a given date."""

    __tablename__ = "timetables"
    __table_args__ = (
        Index("idx_timetables_school_year", "school_id", "academic_year_id"),
        CheckConstraint("status IN ('draft','published','archived')", name="chk_tt_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schools.id", ondelete="CASCADE")
    )
    academic_year_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("academic_years.id", ondelete="CASCADE")
    )
    name: Mapped[str]                        # "Main timetable", "Post-winter revision"
    status: Mapped[str] = mapped_column(server_default=text("'draft'"))
    effective_from: Mapped[date | None]
    # Optimistic concurrency — bumped on every save.
    version: Mapped[int] = mapped_column(server_default=text("1"))
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class TimetableEntry(Base):
    """One cell: this section, this slot, this subject, this teacher."""

    __tablename__ = "timetable_entries"
    __table_args__ = (
        # A section can hold only one class per slot.
        UniqueConstraint("timetable_id", "class_section_id", "period_slot_id",
                         name="uq_entry_section_slot"),
        # THE rule: a teacher cannot be in two places at once.
        # Partial, so unassigned cells (teacher_id NULL) don't collide.
        Index("uq_entry_teacher_slot", "timetable_id", "teacher_id", "period_slot_id",
              unique=True, postgresql_where=text("teacher_id IS NOT NULL")),
        Index("idx_entries_timetable_slot", "timetable_id", "period_slot_id"),
        Index("idx_entries_teacher", "timetable_id", "teacher_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    timetable_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("timetables.id", ondelete="CASCADE")
    )
    class_section_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("class_sections.id", ondelete="CASCADE")
    )
    period_slot_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("period_slots.id", ondelete="CASCADE")
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subjects.id")
    )
    # Nullable on purpose: a principal often places subjects first, teachers after.
    teacher_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="SET NULL")
    )
    note: Mapped[str | None]
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
```

**Free periods store no row.** An empty cell is the absence of an entry, not an entry with nulls. Simpler to query, simpler to reason about.

**Double periods (labs) are two entries** with the same subject in consecutive slots. Don't model spans — the complexity isn't worth it, and the UI can visually merge adjacent identical cells if you want.

`teacher_id` uses `ON DELETE SET NULL` so removing a teacher leaves the structure intact with a visible gap, rather than silently deleting lessons.

---

## 3. Eligible-teacher logic

This is the part that makes the feature usable, and it has three layers:

1. **Assigned** — teachers with a `teaching_assignments` row for this `class_section_id` + `subject_id`. These are the right answer and go at the top.
2. **Qualified** — teachers with `teacher_subjects` for this subject + grade at this school, but no assignment to this section. Show in a second group labelled "Other teachers of this subject." Without this fallback, a school that hasn't filled in assignments gets an empty dropdown and the feature looks broken.
3. **Busy** — anyone already holding an entry in this `period_slot_id` in this timetable. Show them, **disabled, with the reason** ("Busy — 9·B P3").

That last point matters for usability: hiding busy teachers makes the principal wonder where someone went. Showing them greyed with a reason answers the question before it's asked.

Return workload alongside each teacher — periods already assigned that day and that week. A principal choosing between two free teachers wants the one who isn't already teaching seven periods.

```sql
-- Teachers busy in a given slot, for the disabled-state annotation
SELECT e.teacher_id, g.label || ' · ' || cs.section AS busy_in
FROM timetable_entries e
JOIN class_sections cs ON cs.id = e.class_section_id
JOIN grades g ON g.id = cs.grade_id
WHERE e.timetable_id = :tt AND e.period_slot_id = :slot
  AND e.teacher_id IS NOT NULL;
```

---

## 4. API

| Method | Path | Purpose |
|---|---|---|
| GET | `/principal/period-slots?day=6` | Slot definitions for a day |
| PUT | `/principal/period-slots` | Define/edit the day structure |
| POST | `/principal/period-slots/copy` | Copy one day's structure to others |
| GET | `/principal/timetables` | Timetables for the current year |
| POST | `/principal/timetables` | Create a draft |
| **GET** | **`/principal/timetables/{id}/grid?day=6`** | **The one call the builder needs** |
| PUT | `/principal/timetables/{id}/days/{day}` | Save a whole day, transactionally |
| GET | `/principal/timetables/{id}/validate` | Gaps, missing teachers, overloads |
| POST | `/principal/timetables/{id}/publish` | Draft → published |
| POST | `/principal/timetables/{id}/days/{day}/copy-from/{src}` | Duplicate another day |

**Make `/grid` return everything the screen needs in one response**: period slots, class sections, existing entries, the eligible-teacher map per (section, subject), and per-teacher workload counts. The alternative — fetching eligible teachers on every cell click — puts a network round-trip between the principal and every single edit. On a rural school connection that turns a 10-minute task into an hour of waiting.

```jsonc
{
  "day_of_week": 6,
  "version": 7,
  "period_slots": [ { "id": "...", "period_number": 1, "label": "P1",
                      "starts_at": "10:00", "ends_at": "10:50", "is_break": false } ],
  "class_sections": [ { "id": "...", "label": "9 · A", "grade": "Class 9", "section": "A" } ],
  "entries": [ { "class_section_id": "...", "period_slot_id": "...",
                 "subject_id": "...", "teacher_id": "..." } ],
  "eligible_teachers": {
    "<class_section_id>:<subject_id>": [
      { "teacher_id": "...", "name": "Sunita Devi", "tier": "assigned",
        "periods_today": 4, "periods_week": 22 }
    ]
  }
}
```

### Saving a day

`PUT /days/{day}` takes the full set of entries for that day and replaces them in one transaction: delete this timetable's entries whose `period_slot_id` belongs to that day, insert the new set, bump `version`.

Send the client's `version`; reject with `409` and the current grid if it has moved. One principal per school makes this rare, but two open tabs make it inevitable eventually.

Catch the unique-violation on `uq_entry_teacher_slot` and translate it into a readable `422` naming the teacher and both sections — never let a raw Postgres constraint error reach the UI.

---

## 5. Frontend

```
/principal/timetable
  page.tsx                 day selector + grid + editor
  _components/
    DayTabs.tsx
    TimetableGrid.tsx      sticky period column, horizontal scroll
    GridCell.tsx
    CellEditor.tsx         subject chips + grouped teacher list
    ValidationPanel.tsx
  _store/
    useTimetableStore.ts   one day's draft state
```

**Hold one day's grid in client state and derive conflicts locally.** After the `/grid` fetch, every edit is instant — no spinner between clicking a teacher and seeing the cell update. Build a `Map<teacherId, Set<periodSlotId>>` from the current draft and recompute on each change; that's what drives the disabled states in the editor. The server re-validates on save, so local derivation is for responsiveness, not correctness.

**Explicit save per day, not autosave.** Your sketch has a save button and that instinct is right — a principal mid-rearrangement doesn't want half-finished states persisted. But mirror the draft to `localStorage` on every change so a dropped connection or accidental refresh doesn't lose 40 minutes of work, and warn on navigate-away while dirty.

### Usability details that matter more than they sound

- **Copy from another day.** Most school weeks are near-identical across days. Without this, the principal fills the same grid six times and will abandon the feature. This is the single highest-value affordance on the screen.
- **Progress counter** ("18 of 24 slots filled") so partial work has a visible finish line.
- **Keyboard navigation** — arrow keys between cells, Enter to open the editor, Escape to close. A principal filling 48 cells with a mouse will hate you.
- **Repeat-last-selection** — after setting Maths/S. Devi, offer it as the first option in the next cell for the same section.
- **Validation panel before publish**, listing empty slots, subjects with no teacher, and teachers over a configurable daily cap. Warnings, not blockers — real schools have genuine gaps, and a system that refuses to save an imperfect timetable gets worked around.
- **Narrow screens**: a 4+ column grid doesn't fit a phone. Fall back to a per-section stacked list view below ~700px rather than shrinking the grid into illegibility. The principal will mostly be on a desktop, but don't make the mobile case broken.

---

## 6. Edge cases, decided

| Case | Decision |
|---|---|
| Subject set, teacher not yet chosen | Allowed. `teacher_id` nullable; flagged in validation, not blocked. |
| Free period / games | No row. Empty cell. |
| Lunch, assembly | `period_slots.is_break = true`; renders as a band, holds no entries. |
| Saturday has fewer periods | Fewer `period_slots` rows for `day_of_week = 6`. No special code. |
| Double period (lab) | Two entries, same subject, consecutive slots. |
| Same teacher, two subjects | Fine — nothing prevents it. |
| Teacher assigned to a section they don't normally teach | Allowed, via the "other teachers" tier, surfaced as a soft warning. |
| Teacher deleted or deactivated | `SET NULL` — the slot stays, shows "No teacher", appears in validation. |
| Section created after timetable started | New column appears in the grid, all cells empty. Nothing to migrate. |
| Mid-year revision | New `Timetable` row with `effective_from`; old one archived. History preserved for part 2. |
| Two tabs editing | `version` check → `409` with the current grid. |
| Teacher overloaded | Soft warning with a configurable daily cap. Never a hard block. |

---

## 7. Build order

1. `period_slots` + a small setup screen (define the day structure, copy to other days). Nothing works without this and it's easy to forget.
2. `timetables` + `timetable_entries` migrations, including both unique constraints.
3. `GET /grid` — the single composite endpoint.
4. Read-only grid rendering.
5. `CellEditor` with local conflict derivation.
6. `PUT /days/{day}` with transactional replace and constraint-error translation.
7. Copy-from-day, validation panel, publish.

Steps 1–6 give a working builder. Step 7 is what makes it pleasant to use for a real 6-day week.

---

## 8. What this sets up for part 2

The substitution feature needs: who was scheduled (`timetable_entries`), who's absent that date, and who's free in that slot. The first is already here; the third is one query against the same unique index that prevents double-booking. You'll add a `teacher_absences` table (teacher, date, reason) and a `period_substitutions` table (entry_id, date, substitute_teacher_id) — an override layer keyed by date, leaving the base timetable untouched. Nothing in the schema above needs to change for that.