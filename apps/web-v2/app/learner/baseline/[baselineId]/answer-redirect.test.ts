import { describe, expect, it } from "vitest";
import { buildBaselineAnswerRedirect } from "./answer-redirect";

/**
 * Regression guard: the baseline answer action must thread `listen=1`
 * (audio-first "listening mode") and `as=parent` (parent proctor view)
 * through its redirect so both modes persist across every question — on
 * the normal answer submit AND the "Skip" submit. A regression here would
 * silently drop a learner back out of listening mode mid-assessment.
 *
 * `buildBaselineAnswerRedirect` is the exact path the server action
 * redirects to (page.tsx `answerAction` → `redirect(...)`). We feed it the
 * same hidden inputs each <form> in the runner stamps.
 */

const BASELINE_ID = "bsl_123";

/** Mirrors the answer (Next) form's hidden inputs. */
function answerFormData(opts: { asParent?: boolean; listen?: boolean }): FormData {
  const fd = new FormData();
  fd.set("baselineId", BASELINE_ID);
  fd.set("learnerId", "lrn_1");
  fd.set("questionId", "q_1");
  fd.set("response", "Apple");
  if (opts.asParent) fd.set("asParent", "1");
  if (opts.listen) fd.set("listen", "1");
  return fd;
}

/** Mirrors the Skip form's hidden inputs (adds `skipped=1`, no response). */
function skipFormData(opts: { asParent?: boolean; listen?: boolean }): FormData {
  const fd = new FormData();
  fd.set("baselineId", BASELINE_ID);
  fd.set("learnerId", "lrn_1");
  fd.set("questionId", "q_1");
  fd.set("skipped", "1");
  if (opts.asParent) fd.set("asParent", "1");
  if (opts.listen) fd.set("listen", "1");
  return fd;
}

describe("buildBaselineAnswerRedirect — listening + parent-view persistence", () => {
  it("preserves listen=1 and as=parent on a NORMAL answer submit", () => {
    const path = buildBaselineAnswerRedirect(
      BASELINE_ID,
      answerFormData({ asParent: true, listen: true }),
    );
    const url = new URL(path, "https://x.test");
    expect(url.pathname).toBe(`/learner/baseline/${BASELINE_ID}`);
    expect(url.searchParams.get("listen")).toBe("1");
    expect(url.searchParams.get("as")).toBe("parent");
  });

  it("preserves listen=1 and as=parent on a SKIP submit", () => {
    const path = buildBaselineAnswerRedirect(
      BASELINE_ID,
      skipFormData({ asParent: true, listen: true }),
    );
    const url = new URL(path, "https://x.test");
    expect(url.pathname).toBe(`/learner/baseline/${BASELINE_ID}`);
    expect(url.searchParams.get("listen")).toBe("1");
    expect(url.searchParams.get("as")).toBe("parent");
  });

  it("a skip submit and a normal submit with the same modes resolve identically", () => {
    const modes = { asParent: true, listen: true };
    expect(buildBaselineAnswerRedirect(BASELINE_ID, skipFormData(modes))).toBe(
      buildBaselineAnswerRedirect(BASELINE_ID, answerFormData(modes)),
    );
  });

  it("keeps listening mode on its own when the proctor view is off", () => {
    const path = buildBaselineAnswerRedirect(BASELINE_ID, answerFormData({ listen: true }));
    const url = new URL(path, "https://x.test");
    expect(url.searchParams.get("listen")).toBe("1");
    expect(url.searchParams.has("as")).toBe(false);
  });

  it("keeps the proctor view on its own when listening mode is off", () => {
    const path = buildBaselineAnswerRedirect(BASELINE_ID, skipFormData({ asParent: true }));
    const url = new URL(path, "https://x.test");
    expect(url.searchParams.get("as")).toBe("parent");
    expect(url.searchParams.has("listen")).toBe(false);
  });

  it("emits a bare path (no query) when neither mode is active", () => {
    expect(buildBaselineAnswerRedirect(BASELINE_ID, answerFormData({}))).toBe(
      `/learner/baseline/${BASELINE_ID}`,
    );
    expect(buildBaselineAnswerRedirect(BASELINE_ID, skipFormData({}))).toBe(
      `/learner/baseline/${BASELINE_ID}`,
    );
  });
});
