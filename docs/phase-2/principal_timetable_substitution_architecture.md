# Medha — Daily Substitution Architecture (Part 2)

Principal marks absences for a date, sees affected periods turn red, and assigns a free or reserve teacher to each. Plus: reserve teachers attached to a class section during assignment.

---

## 1. The governing principle

**Substitutions are a date-keyed override layer. The base timetable is never mutated.**

If marking Tuesday's absence edits `timetable_entries`, you've permanently rewritten the school's schedule for a one-day event. Every subsequent week inherits the change, and there's no record of what was supposed to happen.

So: `timetable_entries` is the plan, `period_substitutions` is what actually happened on a given date, and the daily view is the plan with overrides applied on read.

This also gives you attendance-style history for free — "who actually taught 9·B on 4 Oct" becomes answerable, which matters for a government-facing product.

---

## 2. Reserve teachers — extending what you already have

You asked for extra teachers per class section. Rather than a new table, add a `role` to `teaching_assignments`. The screen in your screenshot already manages this relationship; reserve teachers become one more group on it.

```python
class TeachingAssignment(Base):
    __tablename__ = "teaching_assignments"
    __table_args__ = (
        # A primary assignment is per-subject.
        Index("uq_assign_primary", "teacher_id", "class_section_id", "subject_id",
              unique=True, postgresql_where=text("role = 'primary'")),
        # A reserve assignment is per-section, subject-agnostic.
        Index("uq_assign_reserve", "teacher_id", "class_section_id",
              unique=True, postgresql_where=text("role = 'reserve'")),
        Index("idx_assignments_section", "class_section_id"),
        CheckConstraint("role IN ('primary','reserve')", name="chk_assign_role"),
        # Primary assignments must name a subject; reserves need not.
        CheckConstraint("role = 'reserve' OR subject_id IS NOT NULL",
                        name="chk_assign_subject"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="CASCADE")
    )
    class_section_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("class_sections.id", ondelete="CASCADE")
    )
    # Null only for reserve teachers, who may cover any subject in the section.
    subject_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subjects.id")
    )
    role: Mapped[str] = mapped_column(server_default=text("'primary'"))
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
```

**Required change to existing code:** the timetable builder's tier-1 eligible-teacher query must now filter `role = 'primary'`. Without it, reserve teachers appear as the section's regular subject teachers and the builder will schedule them as primaries.

A teacher can be primary for one subject and reserve for the same section — legitimate (the Science teacher who also covers gaps), and the two partial indexes allow it.

### On the assignment screen

Add one card below "Subject teachers", reusing the same slide-over picker:

> **Reserve teachers** — *2 assigned* — [Add]
> Available to cover any period in this section when a teacher is absent.
> · Kavita Roy — Science · 3 classes
> · Rajesh Kumar — Science · 2 classes

In the picker, warn (don't block) when adding someone already carrying a heavy load or already reserve for several sections — the same pattern as your existing "Currently class teacher of Class 10 · B" warning.

---

## 3. Absences

```python
class TeacherAbsence(Base):
    """One row per teacher per date. A multi-day leave writes several rows --
    simpler to query than a date range, and handles partial weeks cleanly."""

    __tablename__ = "teacher_absences"
    __table_args__ = (
        UniqueConstraint("teacher_id", "date"),
        Index("idx_absences_school_date", "school_id", "date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schools.id", ondelete="CASCADE")
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="CASCADE")
    )
    date: Mapped[date]
    is_full_day: Mapped[bool] = mapped_column(server_default=text("true"))
    # Used only when is_full_day is false -- "left after lunch" is a real case.
    from_period_number: Mapped[int | None]
    to_period_number: Mapped[int | None]
    reason: Mapped[str | None]          # sick | leave | official_duty | training
    note: Mapped[str | None]
    marked_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
```

Partial-day absence costs two nullable columns now and is painful to retrofit later — a teacher leaving at lunch for a block-office meeting is common enough to be worth it.

---

## 4. Substitutions

```python
class PeriodSubstitution(Base):
    """What actually happened in one period on one date, overriding the plan."""

    __tablename__ = "period_substitutions"
    __table_args__ = (
        # One override per base entry per date.
        UniqueConstraint("date", "timetable_entry_id", name="uq_sub_entry_date"),
        # A substitute cannot be in two places at once on the same date.
        Index("uq_sub_teacher_slot", "date", "substitute_teacher_id", "period_slot_id",
              unique=True,
              postgresql_where=text("substitute_teacher_id IS NOT NULL "
                                    "AND status = 'assigned'")),
        Index("idx_subs_school_date", "school_id", "date"),
        CheckConstraint("status IN ('assigned','self_study','cancelled')",
                        name="chk_sub_status"),
        CheckConstraint("status <> 'assigned' OR substitute_teacher_id IS NOT NULL",
                        name="chk_sub_teacher"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schools.id", ondelete="CASCADE")
    )
    date: Mapped[date]
    timetable_entry_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("timetable_entries.id", ondelete="SET NULL")
    )
    # Denormalised from the entry so the record survives a timetable revision.
    class_section_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("class_sections.id", ondelete="CASCADE")
    )
    period_slot_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("period_slots.id", ondelete="CASCADE")
    )
    subject_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subjects.id")
    )
    original_teacher_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="SET NULL")
    )
    substitute_teacher_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="SET NULL")
    )
    status: Mapped[str] = mapped_column(server_default=text("'assigned'"))
    note: Mapped[str | None]
    assigned_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
```

Two points that matter more than they look:

**`self_study` and `cancelled` are first-class statuses, not the absence of a record.** Sometimes nobody is free. Without an explicit "no cover needed" state, the principal is stuck staring at a red cell they cannot clear, the board never reaches a clean state, and they stop trusting it.

**The denormalised `class_section_id` / `period_slot_id` / `subject_id`** mean a republished timetable doesn't destroy last month's substitution history. `timetable_entry_id` goes null; the record still reads correctly.

---

## 5. The availability query

This is the crux, and it has three conditions — the third is the one that gets missed.

A teacher can cover `(date, period_slot)` only if:

1. They aren't absent on that date (or their partial absence doesn't cover that period)
2. They have no base timetable entry in that slot
3. **They aren't already assigned as a substitute elsewhere in that slot on that date**

Miss condition 3 and the principal double-books the same free teacher across two red cells in the same period — the exact bug the whole feature exists to prevent, reintroduced one layer up. The partial unique index `uq_sub_teacher_slot` enforces it in the database; the query below is for showing the right options.

```sql
WITH busy_base AS (                 -- condition 2
  SELECT e.teacher_id
  FROM timetable_entries e
  WHERE e.timetable_id = :active_timetable_id
    AND e.period_slot_id = :period_slot_id
    AND e.teacher_id IS NOT NULL
),
busy_sub AS (                       -- condition 3
  SELECT s.substitute_teacher_id AS teacher_id
  FROM period_substitutions s
  WHERE s.date = :date
    AND s.period_slot_id = :period_slot_id
    AND s.status = 'assigned'
    AND s.substitute_teacher_id IS NOT NULL
),
absent AS (                         -- condition 1
  SELECT a.teacher_id
  FROM teacher_absences a
  WHERE a.date = :date
    AND (a.is_full_day
         OR :period_number BETWEEN a.from_period_number AND a.to_period_number)
)
SELECT t.id, t.full_name,
  CASE
    WHEN ta.role = 'reserve'      THEN 1   -- reserve for this section
    WHEN ts.subject_id IS NOT NULL THEN 2  -- teaches this subject
    ELSE 3                                 -- free, supervision only
  END AS tier,
  (SELECT count(*) FROM timetable_entries e2
     JOIN period_slots ps ON ps.id = e2.period_slot_id
    WHERE e2.teacher_id = t.id
      AND e2.timetable_id = :active_timetable_id
      AND ps.day_of_week = :day_of_week)        AS periods_today,
  (SELECT count(*) FROM period_substitutions s2
    WHERE s2.substitute_teacher_id = t.id
      AND s2.date = :date AND s2.status = 'assigned') AS covers_today
FROM teachers t
LEFT JOIN teaching_assignments ta
       ON ta.teacher_id = t.id
      AND ta.class_section_id = :class_section_id
      AND ta.role = 'reserve'
LEFT JOIN teacher_subjects ts
       ON ts.teacher_id = t.id AND ts.subject_id = :subject_id
WHERE t.school_id = :school_id
  AND t.role = 'teacher' AND t.approval_status = 'approved'
  AND t.id NOT IN (SELECT teacher_id FROM busy_base)
  AND t.id NOT IN (SELECT teacher_id FROM busy_sub)
  AND t.id NOT IN (SELECT teacher_id FROM absent)
ORDER BY tier, covers_today, periods_today;
```

**Return the unavailable teachers too, with their reason** — "Teaching 10·A", "Absent today", "Already covering 9·A P3". Hiding them makes the principal hunt for someone who isn't in the list; showing them greyed answers the question before it's asked. Same instinct as your existing "Currently class teacher of Class 10 · B" warning.

`ORDER BY tier, covers_today, periods_today` is the fairness rule: reserve teachers first, then whoever is carrying the least load. Without the `covers_today` sort, the same willing teacher gets every substitution and the feature breeds resentment in the staffroom.

---

## 6. API

| Method | Path | Purpose |
|---|---|---|
| GET | `/principal/day?date=2026-10-04` | **The one call the board needs** |
| GET | `/principal/absences?date=` | Absent teachers for a date |
| POST | `/principal/absences` | Mark absent (teacher, date or range, full/partial, reason) |
| DELETE | `/principal/absences/{id}` | Unmark |
| GET | `/principal/substitutions/candidates?entry_id=&date=` | Ranked candidates + unavailable |
| POST | `/principal/substitutions` | Assign / self-study / cancel |
| DELETE | `/principal/substitutions/{id}` | Clear a cell back to uncovered |
| POST | `/principal/substitutions/suggest?date=` | Auto-fill proposal (not committed) |
| GET | `/principal/day/export?date=` | Printable cover sheet |

`GET /day` returns the merged view in one response: period slots, class sections, base entries, absences, substitutions already made, and candidates keyed by entry id. The board is used in a five-minute morning window on a rural connection — a round-trip per cell click makes it unusable.

### "Suggest all"

Greedy, and deliberately a **proposal the principal reviews**, never an auto-commit:

1. Order uncovered periods by fewest candidates first — hardest to fill wins the scarce teachers.
2. For each, take the top-tier candidate with the lowest `covers_today`.
3. Mark that teacher busy for that slot in the working set so step 2 can't reuse them.
4. Return the whole proposal; the principal accepts, edits individual cells, or discards.

Auto-committing would be faster and worse — the principal knows things the data doesn't ("don't give Kavita a Class 10 period, she has exam duty").

---

## 7. UI/UX notes

**This is a morning-rush tool.** The realistic scenario is 9:45 AM, three teachers haven't shown up, assembly ends in fifteen minutes. Optimise for speed over elegance:

- **Mark-absent is one searchable list with toggles**, not a form per teacher. The principal already knows the three names.
- **The header counter** ("3 absent · 7 periods need cover") is the progress indicator. It has to be able to reach zero — which means self-study counts as resolved.
- **Red = needs cover, green = covered, amber = self-study.** Never leave a resolved cell red.
- **Print/export the cover sheet.** The plan must reach teachers who aren't looking at this screen; in most government schools that means a printed sheet on the staffroom wall, not a notification.
- **Default to today, allow any date.** Marking tomorrow's planned leave in advance is genuinely useful; editing yesterday occasionally necessary for records.
- **Narrow screens** fall back to a stacked per-period list rather than a cramped grid.

---

## 8. Edge cases, decided

| Case | Decision |
|---|---|
| Absence unmarked after substitutions assigned | Prompt: "3 periods were covered — remove those assignments?" Never silently delete. |
| Substitute later marked absent | Their substitutions surface in a "needs re-cover" strip; those cells return to red. |
| Nobody free | `self_study` or `cancelled`. Always provide an exit. |
| Teacher absent with no periods that day | No red cells. Absence still recorded. |
| Absent teacher is the class teacher | Irrelevant here — only timetable entries matter. |
| Base timetable revised while future substitutions exist | `timetable_entry_id` → null; denormalised columns keep the record readable. |
| Two tabs assigning the same free teacher | DB unique index rejects the second; translate to a readable 409 and refresh the board. |
| Reserve teacher busy with their own class | Appears under "Unavailable" with the reason. Reserve status never overrides a real conflict. |
| Partial-day absence | `is_full_day = false` + period range; only those periods go red. |
| Half-day holiday / exam day | Out of scope. If it comes up, a school-calendar table with a day-type is the clean answer — don't hack it into absences. |

---

## 9. Build order

1. `teaching_assignments.role` migration + the two partial unique indexes.
2. Update the timetable builder's tier-1 query to filter `role='primary'` — **existing behaviour breaks without this.**
3. Reserve-teachers card on the assignment screen (reuses the picker you already built).
4. `teacher_absences` + mark/unmark endpoints + the absence strip.
5. `GET /day` returning the merged plan-plus-overrides view.
6. Board rendering with the three cell states.
7. Candidates endpoint + substitute picker.
8. Assign / self-study / cancel, with constraint-error translation.
9. "Suggest all" and the printable cover sheet.

Steps 1–8 give a working board. Step 9 is what makes it fast enough to use under time pressure — and the print sheet is what makes the output actually reach the staffroom.