/**
 * Browser-stored data that belongs to a person (not a UI preference).
 *
 * School computers are shared, and the stores below hold student names,
 * attendance and work logs under fixed keys -- so a second user could otherwise
 * read, edit or delete the first user's data. Two guards:
 *   1. everything listed here is wiped when a session ends, and
 *   2. it is also wiped when a *different* person signs in (covers a tab that
 *      was closed without logging out).
 * UI preferences (locale, sidebar state) are deliberately left alone.
 */
const USER_DATA_KEYS = [
  "medha.attendance.v1",
  "medha.teacher_work_updates.v1",
  "medha.school_notices.v1",
  "medha.lessonContext",
];
const OWNER_KEY = "medha.owner";

export function clearUserData(): void {
  try {
    for (const key of USER_DATA_KEYS) localStorage.removeItem(key);
    localStorage.removeItem(OWNER_KEY);
  } catch {
    /* storage unavailable (private mode / blocked) -- nothing to clear */
  }
}

/** Call when a session is established: wipes leftovers from a previous person. */
export function claimUserData(userId: string): void {
  try {
    const owner = localStorage.getItem(OWNER_KEY);
    if (owner !== userId) {
      for (const key of USER_DATA_KEYS) localStorage.removeItem(key);
      localStorage.setItem(OWNER_KEY, userId);
    }
  } catch {
    /* ignore */
  }
}
