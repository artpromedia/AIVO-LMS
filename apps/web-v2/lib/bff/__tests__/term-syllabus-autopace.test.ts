/**
 * Remediation Sprint 11 — saving a term syllabus auto-paces.
 *
 * The audit's GAP-5: a saved syllabus silently did nothing until a separate
 * "Generate pacing plan" click. Saving now returns an explicit `pacing`
 * outcome: "generated" when brain-svc is live, "unavailable" with the exact
 * reason when it is not — and a pacing problem NEVER fails the save.
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { SessionProfile } from "@/lib/auth/types";

const SKY = "lrn_demo_sky";

beforeAll(() => {
  process.env.AIVO_SEED_DEMO_JOURNEY = "1";
  // Explicitly NOT live: no INTERNAL_SERVICE_TOKEN in this test env.
  delete process.env.INTERNAL_SERVICE_TOKEN;
});

const PARSED = {
  subject: "math",
  total_terms: 1,
  terms: [
    {
      term: 1,
      units: [
        {
          title: "Week 1 — Counting",
          topics: ["Counting to 20"],
          objectives: ["Count objects to 20"],
          standards: ["K.CC.A.1"],
          vocabulary: ["count"],
        },
        {
          title: "Week 2 — Addition",
          topics: ["Addition within 10"],
          objectives: ["Add within 10"],
          standards: ["K.OA.A.2"],
          vocabulary: ["sum"],
        },
      ],
    },
  ],
};

describe("handleSaveTermSyllabus auto-pacing", () => {
  it(
    "saves durably and reports pacing 'unavailable' (with the reason) when brain-svc is not live",
    { timeout: 30_000 },
    async () => {
      const { ensureSeeded } = await import("@/lib/db/seed");
      const { handleSaveTermSyllabus } = await import("@/lib/bff/term-syllabus");
      ensureSeeded();

      // The seeded demo parent (MOCK_USERS.parent) is linked to Sky.
      const { MOCK_USERS } = await import("@/lib/auth/mock-session");
      const session = MOCK_USERS.parent as SessionProfile;

      const req = new Request("http://localhost/api/bff/parent/term-syllabus", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subject: "math", text: "Week 1…", parsed: PARSED }),
      });
      const res = await handleSaveTermSyllabus(req, "req_test", session, SKY);
      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        data: {
          syllabus: { id: string; units: unknown[] };
          pacing: { status: string; reason?: string };
        };
      };
      // The save is durable regardless of pacing.
      expect(body.data.syllabus.id).toBeTruthy();
      expect(body.data.syllabus.units.length).toBe(2);
      // And the caller is told exactly why pacing did not run.
      expect(body.data.pacing.status).toBe("unavailable");
      expect(body.data.pacing.reason).toContain("INTERNAL_SERVICE_TOKEN");
    },
  );
});
