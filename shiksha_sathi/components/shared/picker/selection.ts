/**
 * Pure logic for the Random Picker -- parsing input and choosing a winner.
 * Deliberately has no knowledge of animation, React state, or timing: the
 * roller (roller.tsx) only ever finds out who won and plays a spin that
 * *looks* like it lands on that name. This file is what actually decides.
 */

export type PickableStudent = {
  /** Occurrence-scoped, e.g. "Aman#0" / "Aman#1" -- two students can share a
   *  name, so identity is (name, nth time it appears), not the name alone. */
  id: string;
  name: string;
};

/**
 * One student per non-blank line. Whitespace-trimmed, blank lines dropped,
 * duplicate names kept as distinct entries (never silently deduped).
 */
export function parseStudents(raw: string): PickableStudent[] {
  const occurrences = new Map<string, number>();
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((name) => {
      const n = occurrences.get(name) ?? 0;
      occurrences.set(name, n + 1);
      return { id: `${name}#${n}`, name };
    });
}

/**
 * Uniformly picks one entry from `pool`. Call this BEFORE the roller starts
 * spinning -- the winner is decided here, then the animation is told what to
 * land on. The visual spin never determines the outcome.
 */
export function selectRandomStudent<T>(pool: readonly T[]): T {
  if (pool.length === 0) {
    throw new Error("selectRandomStudent: pool is empty.");
  }
  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}
