/**
 * Builds the post-answer redirect path for the baseline runner.
 *
 * The runner threads `listen=1` (audio-first "listening mode") and
 * `as=parent` (parent proctor view) through the answer server action so
 * both modes persist across every question — on the normal answer submit
 * AND the "Skip" submit (both forms stamp the same hidden inputs). This is
 * centralised here so the persistence is unit-testable and a regression
 * can't silently drop a learner back out of listening mode mid-assessment.
 *
 * The `skipped` flag is deliberately NOT part of the redirect — it only
 * affects how the attempt is recorded — so a skip submit and a normal
 * submit with the same modes resolve to the identical destination.
 */
export function buildBaselineAnswerRedirect(baselineId: string, formData: FormData): string {
  const asParent = String(formData.get("asParent") || "") === "1";
  const listen = String(formData.get("listen") || "") === "1";
  const params = new URLSearchParams();
  if (asParent) params.set("as", "parent");
  // Keep the audio-first "listening mode" on across questions once chosen.
  if (listen) params.set("listen", "1");
  const qs = params.toString();
  return `/learner/baseline/${baselineId}${qs ? `?${qs}` : ""}`;
}
