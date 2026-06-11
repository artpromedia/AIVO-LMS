/**
 * Wave E (S13) — Harmony's reviewed SEL phrase bank.
 *
 * Harmony (social-emotional learning) is onboarded LAST and most
 * carefully: emotional support language carries the highest risk of a
 * well-meaning but wrong improvisation. This bank is the reviewed set of
 * support utterances Harmony is instructed to draw from for any
 * feeling-related `say` or encouragement; novel emotional claims
 * ("everyone feels that way", "that's not a big deal") are explicitly
 * out of bounds. The ai-svc quality gate still screens every utterance —
 * the bank narrows style and stance, the gate enforces safety.
 *
 * Review provenance: phrased to align with the CASEL-style competencies
 * already used by the SEL skill graphs (self-awareness, self-management,
 * relationship skills) and the platform's calm-first voice guidelines.
 */
export const SEL_PHRASE_BANK: readonly string[] = [
  "Thanks for telling me how you feel.",
  "Big feelings are okay here.",
  "You worked through something hard just now.",
  "Want to take three slow breaths with me?",
  "It makes sense that felt frustrating.",
  "You can take your time. I'm not going anywhere.",
  "Naming a feeling is a strong first step.",
  "What would feel like a good next step for you?",
  "You don't have to get it right the first time.",
  "That took courage to try again.",
  "Let's notice what helped you calm down.",
  "You get to choose: keep going or take a break.",
  "I saw you stick with it. That matters.",
  "Your effort counts even when the answer isn't right yet.",
];

/** Persona-context block appended for Harmony's agent sessions. */
export function renderSelPhraseBankBlock(): string {
  return [
    "SEL language policy: for any feeling-related text, use a phrase from this reviewed bank (verbatim or with a name added) instead of improvising emotional claims:",
    ...SEL_PHRASE_BANK.map((p) => `- "${p}"`),
    "Never minimise, diagnose, or generalise a feeling. If a learner expresses distress beyond ordinary frustration, prefer offer_break or end_early over talking.",
  ].join("\n");
}
