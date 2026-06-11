/**
 * Birth-date validation for the COPPA age gate (Sprint A6).
 * YYYY-MM-DD, a real calendar date, not in the future, age ≤ 21.
 * The server derives the under-13 consent regime from this value; the
 * client only validates shape and plausibility.
 */
export type BirthDateError = "format" | "invalid" | "future" | "tooOld";

export function validateBirthDate(raw: string): BirthDateError | null {
  const value = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "format";
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return "invalid";
  const now = new Date();
  if (date.getTime() > now.getTime()) return "future";
  const age = (now.getTime() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (age > 21) return "tooOld";
  return null;
}

/** Whether a valid birth date means the learner is under 13 (COPPA VPC). */
export function isUnder13(birthDate: string, now: Date = new Date()): boolean {
  const date = new Date(`${birthDate.trim()}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return true; // fail closed
  const age = (now.getTime() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return age < 13;
}
