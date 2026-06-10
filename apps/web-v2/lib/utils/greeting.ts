/**
 * Shared greeting utilities used by role home pages.
 *
 * Centralizing these two helpers prevents logic drift between the
 * teacher, therapist, and caregiver home dashboards.
 */

const HONORIFICS = new Set([
  "Ms.",
  "Ms",
  "Mr.",
  "Mr",
  "Mrs.",
  "Mrs",
  "Mx.",
  "Mx",
  "Dr.",
  "Dr",
  "Prof.",
  "Prof",
]);

/**
 * Return the first non-honorific word from a display name.
 * "Ms. Vega"  → "Vega"
 * "Dr. Smith" → "Smith"
 * "Jordan"    → "Jordan"
 */
export function greetingName(displayName: string): string {
  const parts = displayName.trim().split(/\s+/);
  for (const p of parts) {
    if (!HONORIFICS.has(p)) return p;
  }
  return parts[0] ?? displayName;
}

/**
 * Coarse time-of-day bucket used for greeting copy.
 * 00–11 → "morning", 12–17 → "afternoon", 18–23 → "evening"
 */
export function greetingSlot(): "morning" | "afternoon" | "evening" {
  const hour = new Date().getHours();
  return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
}

/** Full greeting string: "Good morning, Jordan." */
export function buildGreeting(displayName: string): string {
  const slot = greetingSlot();
  const salutation =
    slot === "morning" ? "Good morning" : slot === "afternoon" ? "Good afternoon" : "Good evening";
  return `${salutation}, ${greetingName(displayName)}.`;
}
