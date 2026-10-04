/**
 * Mirrors backend/src/backend/auth/password_policy.py so people get instant
 * feedback. The backend is the authority -- it re-checks everything, and also
 * rejects passwords containing the person's name/email.
 */
export const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_MAX_BYTES = 72;

const COMMON = new Set([
  "password", "password1", "password12", "password123", "password1234", "passw0rd", "p@ssw0rd",
  "12345678", "123456789", "1234567890", "123123123", "1q2w3e4r5t", "qwertyuiop", "qwerty123",
  "qwertyui", "iloveyou1", "abc12345", "abcd1234", "admin123", "admin1234", "welcome123",
  "letmein123", "changeme123", "india12345", "india@123", "bihar@123", "bihar12345", "school123",
  "school@123", "teacher123", "student123", "principal123", "medha123", "medha@123",
  "111111111", "000000000", "9876543210", "0123456789",
]);

/** Everything but letters and digits, matching backend's `re.sub(r"[^a-z0-9]", "", s)` --
 * so "kiran-devi" and "kirandevi" are treated as the same string. */
function squash(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Returns a user-facing problem, or null if the password is acceptable.
 * `email`/`name` (the account's own, if known yet) are checked the same way
 * the backend does: rejected if the password contains them.
 */
export function passwordProblem(
  password: string,
  identity?: { email?: string; name?: string },
): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) return "That password is too long.";
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || new Set(lower).size < 4) return "That password is too common.";
  if (!(/\p{L}/u.test(password) && /[\d\P{L}]/u.test(password.replace(/\p{L}/gu, "")))) {
    return "Mix letters with at least one number or symbol.";
  }
  const squashed = squash(password);
  const emailLocal = identity?.email ? squash(identity.email.split("@")[0] ?? "") : "";
  if (emailLocal.length >= 4 && squashed.includes(emailLocal)) {
    return "Password must not contain your email address.";
  }
  for (const part of (identity?.name ?? "").toLowerCase().split(/\s+/)) {
    if (part.length >= 4 && squashed.includes(squash(part))) {
      return "Password must not contain your name.";
    }
  }
  return null;
}

const LETTERS = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "@#%&*!?";

/** A random password that passes `passwordProblem`, for a principal to read
 * out or share. Uses the browser's CSPRNG, never Math.random. */
export function suggestPassword(): string {
  const pick = (alphabet: string) => {
    const n = crypto.getRandomValues(new Uint32Array(1))[0] % alphabet.length;
    return alphabet[n];
  };
  for (let attempt = 0; attempt < 20; attempt++) {
    const chars = [
      ...Array.from({ length: 8 }, () => pick(LETTERS)),
      ...Array.from({ length: 3 }, () => pick(DIGITS)),
      pick(SYMBOLS),
    ];
    // Fisher-Yates shuffle so the symbol and digits aren't always at the end
    for (let i = chars.length - 1; i > 0; i--) {
      const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    const candidate = chars.join("");
    if (passwordProblem(candidate) === null) return candidate;
  }
  throw new Error("Could not generate a password.");
}
