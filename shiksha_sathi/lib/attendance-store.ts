/**
 * Attendance is real now (see backend.attendance + `getAttendance`/
 * `markAttendance` in lib/api.ts, and `getPrincipalAttendanceSummary` for the
 * principal's stats) -- this file used to be a localStorage-mocked store for
 * the whole feature, but every consumer has moved to the backend. This one
 * date-formatting helper is all that's still shared.
 */
export function todayISO(d = new Date()): string {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}
