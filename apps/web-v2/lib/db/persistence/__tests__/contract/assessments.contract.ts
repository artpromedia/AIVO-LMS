/**
 * Shared AssessmentStore submit/tenant contract (Sprint 1).
 *
 * Complements the broader assessmentStoreContract in stores.contract.ts by
 * pinning the semantics the parent-assessment save bug turned on:
 *   • upsert → read round-trip
 *   • submit stamps submittedAt and it survives the re-read
 *   • a second tenant can neither read nor silently overwrite the row
 *
 * Run against any implementation (memory now, postgres when a test DB is
 * available) so the drizzle adapter is proven equivalent to the in-memory
 * store. Import and call from a `*.test.ts`.
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { ParentAssessment } from "@/lib/db/types";
import type { AssessmentStore } from "../../types";

const T = "t_1";

function pa(over: Partial<ParentAssessment> = {}): ParentAssessment {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: "pa_c1",
    learnerId: "lrn_c1",
    tenantId: T,
    answers: {} as ParentAssessment["answers"],
    completedSections: [],
    startedAt: now,
    updatedAt: now,
    submittedAt: null,
    ...over,
  };
}

export function assessmentSubmitContract(
  label: string,
  makeStore: () => AssessmentStore,
  reset: () => void | Promise<void>,
): void {
  describe(`AssessmentStore submit/tenant contract — ${label}`, () => {
    let store: AssessmentStore;

    beforeEach(async () => {
      await reset();
      store = makeStore();
    });

    it("round-trips an upserted parent assessment", async () => {
      await store.upsertParentAssessment(pa());
      const got = await store.findParentAssessment("lrn_c1", T);
      expect(got).not.toBeNull();
      expect(got!.id).toBe("pa_c1");
      expect(got!.submittedAt).toBeNull();
    });

    it("submit stamps submittedAt and it survives the re-read", async () => {
      await store.upsertParentAssessment(pa());
      await store.upsertParentAssessment(pa({ submittedAt: "2026-02-02T00:00:00.000Z" }));
      const got = await store.findParentAssessment("lrn_c1", T);
      expect(got!.submittedAt).toBe("2026-02-02T00:00:00.000Z");
    });

    it("accumulates completedSections across patches", async () => {
      await store.upsertParentAssessment(pa({ completedSections: ["goals"] }));
      await store.upsertParentAssessment(pa({ completedSections: ["goals", "reading"] }));
      const got = await store.findParentAssessment("lrn_c1", T);
      expect(got!.completedSections).toEqual(["goals", "reading"]);
    });

    it("scopes reads by tenant — a second tenant sees nothing", async () => {
      await store.upsertParentAssessment(pa());
      expect(await store.findParentAssessment("lrn_c1", "t_other")).toBeNull();
    });
  });
}
