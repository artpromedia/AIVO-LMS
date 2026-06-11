/**
 * Wave E (S9) — agentic lesson player (Nova pilot), exercised at the
 * network seam: a fixture agent answers the BFF agent-session /
 * agent-turn calls, so the spec proves the full client loop (open →
 * observe → directive → render) without a live tutor-svc/ai-svc.
 *
 * Also proves the two safety invariants:
 *   - flag OFF (no `agent=1`): the player makes ZERO agent calls and
 *     renders no panel — byte-identical deterministic flow;
 *   - slow agent: a directive that misses the 1500ms deadline is
 *     discarded and the lesson continues exactly as before.
 */
import { expect, test, type Page } from "@playwright/test";
import { setLearnerSession } from "./lesson-player-surfaces.helpers";

const OPEN_BODY = {
  ok: true,
  requestId: "fixture",
  data: {
    enabled: true,
    session: { sessionId: "agent-fixture-1", tutorKey: "nova", tutorName: "Nova" },
  },
};

function turnBody(directive: Record<string, unknown>) {
  return {
    ok: true,
    requestId: "fixture",
    data: {
      enabled: true,
      decision: {
        kind: "action",
        action: null,
        effect: null,
        reason: null,
        rung: "full",
        seq: 1,
        latencyMs: 80,
      },
      directive,
    },
  };
}

async function gotoAgentFixture(page: Page) {
  await page.goto("/learner/lesson-player-fixture?surfaceType=choice_grid&agent=1", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByTestId("in-lesson-tutor-panel")).toBeVisible({ timeout: 30_000 });
}

/** Advance to the guided choice-grid beat and answer it incorrectly. */
async function answerGuidedWrong(page: Page) {
  const surface = page.getByLabel("choice-grid-surface");
  const next = page.getByRole("button", { name: "Next" });
  await expect(next.or(surface).first()).toBeVisible({ timeout: 30_000 });
  for (let i = 0; i < 10; i += 1) {
    if (await surface.isVisible()) break;
    await next.click();
    await expect(surface.or(next).first()).toBeVisible({ timeout: 5_000 });
  }
  await expect(surface).toBeVisible();
  // Correct answer is "4" — pick "3" to trigger an incorrect observation.
  await page.getByRole("radio", { name: "3", exact: true }).click();
  await page.getByLabel("submit choice").click();
}

test("agent scaffold directive renders inside the lesson", async ({ context, page }) => {
  await setLearnerSession(context);
  const turnCalls: unknown[] = [];
  await page.route("**/agent-session", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(OPEN_BODY) }),
  );
  await page.route("**/agent-turn", async (route) => {
    turnCalls.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        turnBody({ type: "show_scaffold", text: "Count up from two: three, four." }),
      ),
    });
  });

  await gotoAgentFixture(page);
  await answerGuidedWrong(page);

  // The fixture agent's scaffold appears alongside today's feedback.
  await expect(page.getByTestId("agent-scaffold")).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId("agent-scaffold")).toContainText("Count up from two");

  // The observation the client sent is the real one.
  expect(turnCalls.length).toBe(1);
  const sent = turnCalls[0] as {
    sessionId: string;
    observation: { beatKind: string; isCorrect: boolean; learnerResponse: string };
  };
  expect(sent.sessionId).toBe("agent-fixture-1");
  expect(sent.observation.beatKind).toBe("guided");
  expect(sent.observation.isCorrect).toBe(false);
  // Choice grids submit the selected choice ID ("3" is the second option).
  expect(sent.observation.learnerResponse).toBe("choice-2");
});

test("agent break offer is the learner's choice", async ({ context, page }) => {
  await setLearnerSession(context);
  await page.route("**/agent-session", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(OPEN_BODY) }),
  );
  await page.route("**/agent-turn", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        turnBody({ type: "offer_break", reason: "frustration", durationSeconds: 60 }),
      ),
    }),
  );

  await gotoAgentFixture(page);
  await answerGuidedWrong(page);

  await expect(page.getByTestId("tutor-panel-break-offer")).toBeVisible({ timeout: 5_000 });
  // Declining keeps the lesson exactly where it was.
  await page.getByRole("button", { name: "Keep going" }).click();
  await expect(page.getByTestId("tutor-panel-break-offer")).toHaveCount(0);
  await expect(page.getByLabel("choice-grid-surface")).toBeVisible();
});

test("a slow agent misses the deadline and the lesson continues deterministically", async ({
  context,
  page,
}) => {
  await setLearnerSession(context);
  await page.route("**/agent-session", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(OPEN_BODY) }),
  );
  await page.route("**/agent-turn", async (route) => {
    // Stall past the client's 1500ms AbortSignal deadline.
    await new Promise((r) => setTimeout(r, 2_500));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(turnBody({ type: "say", text: "too late to show" })),
    });
  });

  await gotoAgentFixture(page);
  await answerGuidedWrong(page);

  // Today's deterministic feedback shows immediately…
  await expect(page.getByText(/Not quite —/)).toBeVisible({ timeout: 5_000 });
  // …and the late directive is discarded: no agent message ever lands.
  await page.waitForTimeout(3_000);
  await expect(page.getByTestId("tutor-panel-message")).toHaveCount(0);
  // The learner can advance as always.
  await expect(page.getByRole("button", { name: "Next" })).toBeEnabled();
});

test("agent off: zero agent network calls and no panel", async ({ context, page }) => {
  await setLearnerSession(context);
  const agentCalls: string[] = [];
  await page.route("**/agent-*", (route) => {
    agentCalls.push(route.request().url());
    return route.fulfill({ status: 500, body: "must never be called" });
  });

  await page.goto("/learner/lesson-player-fixture?surfaceType=choice_grid", {
    waitUntil: "domcontentloaded",
  });
  const surface = page.getByLabel("choice-grid-surface");
  const next = page.getByRole("button", { name: "Next" });
  await expect(next.or(surface).first()).toBeVisible({ timeout: 30_000 });

  await expect(page.getByTestId("in-lesson-tutor-panel")).toHaveCount(0);
  expect(agentCalls).toEqual([]);
});
