/**
 * Screen-reader announcement builders for the lesson stage.
 *
 * Pure string builders — the stage screen feeds them already-translated,
 * tier-appropriate copy (the same `voice` lines the tutor panel shows) and
 * speaks the result through `useA11yStyle().announce`, which wraps
 * `AccessibilityInfo.announceForAccessibility` for TalkBack/VoiceOver.
 *
 * Copy rule (shame-free): a miss is never "wrong" or "failed" — the miss
 * line comes from the tier voice ("Not yet — the answer is …" register),
 * identical to what a sighted learner reads on the tutor panel.
 */

export interface AnswerAnnouncementInput {
  correct: boolean;
  /** Tier voice line shown on a correct answer (already translated). */
  encourage: string;
  /** Tier voice line shown on a miss (already translated, names the answer). */
  missLine: string;
}

export function buildAnswerAnnouncement(input: AnswerAnnouncementInput): string {
  return input.correct ? input.encourage : input.missLine;
}

type Translate = (key: string, values?: Record<string, unknown>) => string;

export function buildBeatAnnouncement(t: Translate, input: { index: number; total: number }): string {
  return t("learnerStage.a11y.beatAdvance", { index: input.index, total: input.total });
}

export function buildCompletionAnnouncement(t: Translate, input: { xpEarned: number }): string {
  return t("learnerStage.a11y.completed", { xp: input.xpEarned });
}
