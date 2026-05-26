/**
 * Sprint 14 (F) — staging red-team E2E.
 *
 * Runs a curated subset of the offline red-team corpus against the
 * staging responsible-ai-svc /api/responsible-ai/evaluate endpoint.
 *
 * Self-skips when:
 *   - RESPONSIBLE_AI_SVC_URL is not set (CI for branches that don't
 *     touch the staging service).
 *   - the curated fixture directory isn't reachable from this worktree
 *     (allows the spec to ship on branches where the corpus hasn't
 *     been synced yet).
 *
 * Required gates (sampled subset):
 *   - all positives → recommendedAction in ('block', 'escalate')
 *   - all negatives → recommendedAction === 'allow'
 *
 * The full ≥99% / ≤1% gate runs offline in
 * services/responsible-ai-svc/__tests__/red-team.test.ts — the E2E
 * exists to catch staging drift (env vars, service connectivity,
 * audit-svc availability).
 */
import { test, expect, request as pwRequest } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const RESPONSIBLE_AI_SVC_URL =
  process.env.RESPONSIBLE_AI_SVC_URL ?? "http://localhost:3071";

const FIXTURES_ROOT = resolve(
  __dirname,
  "../../../services/responsible-ai-svc/__tests__/fixtures/red-team",
);

interface Fixture {
  id: string;
  text: string;
  expected_verdict: "block" | "review" | "allow";
  ageBand: string | null;
}

function loadCuratedSubset(side: "positives" | "negatives"): Fixture[] {
  let files: string[];
  try {
    files = readdirSync(join(FIXTURES_ROOT, side));
  } catch {
    return [];
  }
  // Curated subset: take the first 8 of each side so the E2E stays
  // under a minute on staging. The offline suite already covers the
  // full corpus.
  return files
    .filter((f) => f.endsWith(".json"))
    .slice(0, 8)
    .map(
      (f) =>
        JSON.parse(
          readFileSync(join(FIXTURES_ROOT, side, f), "utf8"),
        ) as Fixture,
    );
}

const positives = loadCuratedSubset("positives");
const negatives = loadCuratedSubset("negatives");

test.describe("sprint14 red-team E2E", () => {
  test.skip(
    !process.env.RESPONSIBLE_AI_SVC_URL,
    "RESPONSIBLE_AI_SVC_URL not configured",
  );
  test.skip(
    positives.length === 0 && negatives.length === 0,
    "red-team fixtures not synced into this checkout",
  );

  test("blocks every positive in the curated subset", async () => {
    const req = await pwRequest.newContext({
      baseURL: RESPONSIBLE_AI_SVC_URL,
    });
    try {
      for (const fx of positives) {
        const res = await req.post("/api/responsible-ai/evaluate", {
          headers: { "content-type": "application/json" },
          data: {
            learnerId: `e2e-red-${fx.id}`,
            contextType: "chat",
            inputSummary: fx.text,
            output: fx.text,
            policyMode: "block",
          },
        });
        expect(res.ok(), `staging 5xx for ${fx.id}`).toBeTruthy();
        const body = (await res.json()) as {
          recommendedAction: string;
        };
        expect(
          ["block", "escalate"],
          `${fx.id} expected block/escalate, got ${body.recommendedAction}`,
        ).toContain(body.recommendedAction);
      }
    } finally {
      await req.dispose();
    }
  });

  test("allows every negative in the curated subset", async () => {
    const req = await pwRequest.newContext({
      baseURL: RESPONSIBLE_AI_SVC_URL,
    });
    try {
      for (const fx of negatives) {
        const res = await req.post("/api/responsible-ai/evaluate", {
          headers: { "content-type": "application/json" },
          data: {
            learnerId: `e2e-red-${fx.id}`,
            contextType: "chat",
            inputSummary: fx.text,
            output: fx.text,
            policyMode: "block",
          },
        });
        expect(res.ok()).toBeTruthy();
        const body = (await res.json()) as { recommendedAction: string };
        expect(
          body.recommendedAction,
          `${fx.id} should be allow, got ${body.recommendedAction}`,
        ).toBe("allow");
      }
    } finally {
      await req.dispose();
    }
  });
});
