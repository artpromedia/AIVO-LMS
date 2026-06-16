/**
 * Cross-platform learner unification (Task #34) — memory == postgres parity.
 *
 * Covers the two store primitives the BFF reconcile/dual-write path relies on:
 *   - setIdentityLink: link an existing web profile to its identity-svc UUID
 *     (idempotent, tenant-scoped, surfaces in subsequent reads).
 *   - createFromIdentity: materialize a pre-linked web profile + primary
 *     relationship for a learner that already exists in identity-svc (the
 *     "surface a mobile-origin learner" direction).
 */
import { it, expect } from "vitest";
import { createLearner, getLearner, listLearnersForParent } from "@/lib/db/repos";
import { runInBothModes } from "./parity.harness";

const T = "t_demo";
const PARENT = "u_demo_parent";
const UUID = "11111111-2222-3333-4444-555555555555";

runInBothModes("learner-identity-link", (ctx) => {
  it("setIdentityLink stores the canonical UUID and is idempotent", async () => {
    const created = await createLearner({
      tenantId: T,
      parentUserId: PARENT,
      data: { firstName: "Robin", birthYear: 2016 },
    });
    expect(created.identityLearnerId ?? null).toBeNull();

    const linked = await ctx.persistence().learners.setIdentityLink(created.id, T, UUID);
    expect(linked?.identityLearnerId).toBe(UUID);

    // Persisted: a fresh read carries the link.
    expect((await getLearner(created.id, T))?.identityLearnerId).toBe(UUID);

    // Idempotent: re-linking the same UUID is a no-op that still returns it.
    const again = await ctx.persistence().learners.setIdentityLink(created.id, T, UUID);
    expect(again?.identityLearnerId).toBe(UUID);

    // Tenant-scoped: a foreign tenant cannot link.
    expect(await ctx.persistence().learners.setIdentityLink(created.id, "t_other", UUID)).toBeNull();
  });

  it("createFromIdentity materializes a pre-linked profile under the parent", async () => {
    const learner = await ctx.persistence().learners.createFromIdentity({
      tenantId: T,
      parentUserId: PARENT,
      identityLearnerId: UUID,
      name: "Mobile Kid",
      birthYear: 2017,
      primaryLanguage: "es",
    });
    expect(learner.identityLearnerId).toBe(UUID);
    expect(learner.firstName).toBe("Mobile Kid");
    expect(learner.primaryLanguage).toBe("es");

    // Appears in the parent's web learner list (the visibility contract).
    const mine = await listLearnersForParent(PARENT, T);
    const found = mine.find((l) => l.id === learner.id);
    expect(found?.identityLearnerId).toBe(UUID);

    // The first relationship is primary.
    expect(found).toBeDefined();
  });

  it("createFromIdentity is idempotent — a repeat returns the same profile", async () => {
    const first = await ctx.persistence().learners.createFromIdentity({
      tenantId: T,
      parentUserId: PARENT,
      identityLearnerId: UUID,
      name: "Mobile Kid",
      birthYear: 2017,
    });
    const second = await ctx.persistence().learners.createFromIdentity({
      tenantId: T,
      parentUserId: PARENT,
      identityLearnerId: UUID,
      name: "Mobile Kid (again)",
      birthYear: 2017,
    });
    expect(second.id).toBe(first.id);
    // No duplicate web profile surfaced for the one canonical identity learner.
    const mine = await listLearnersForParent(PARENT, T);
    expect(mine.filter((l) => l.identityLearnerId === UUID).length).toBe(1);
  });
});
