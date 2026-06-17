/**
 * Cross-platform learner unification (Task #34) — provisionAndLink idempotency.
 *
 * The blocking risk this guards: if a prior attempt created the canonical
 * identity-svc learner but failed to persist the link on the web profile, the
 * web learner stays unlinked. A naive retry (next GET reconcile or PIN-set)
 * would create a SECOND identity learner — a duplicate/split canonical
 * identity. provisionAndLink must instead discover the orphaned identity
 * learner and reuse it.
 *
 * The identity-svc HTTP client is mocked; the real in-memory persistence runs
 * so the link actually round-trips through the store.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/bff/identity-learners", () => ({
  isIdentitySvcEnabled: () => true,
  createLearnerViaIdentity: vi.fn(),
  listLearnersViaIdentity: vi.fn(),
}));

import { provisionAndLink } from "@/lib/bff/learner-unification";
import {
  createLearnerViaIdentity,
  listLearnersViaIdentity,
} from "@/lib/bff/identity-learners";
import { createLearner, getLearner } from "@/lib/db/repos";
import { resetStore } from "@/lib/db/store";
import { resetPersistence } from "@/lib/db/persistence";

const createMock = vi.mocked(createLearnerViaIdentity);
const listMock = vi.mocked(listLearnersViaIdentity);

const T = "t_demo";
const PARENT = "u_unify_parent";
const ORPHAN_UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const NEW_UUID = "99999999-8888-7777-6666-555555555555";

describe("provisionAndLink idempotency / partial-failure recovery", () => {
  beforeEach(() => {
    resetStore();
    resetPersistence();
    createMock.mockReset();
    listMock.mockReset();
  });

  it("reuses an orphaned identity learner instead of creating a duplicate", async () => {
    const web = await createLearner({
      tenantId: T,
      parentUserId: PARENT,
      data: { firstName: "Alex", birthYear: 2016 },
    });
    expect(web.identityLearnerId ?? null).toBeNull();

    // Simulates the orphan left by a prior attempt whose link-write failed:
    // an identity learner with this learner's name, not linked to any profile.
    listMock.mockResolvedValue({ ok: true, data: [{ id: ORPHAN_UUID, name: "Alex" }] });

    const linked = await provisionAndLink("Bearer x", web, T, { parentUserId: PARENT });

    expect(linked.identityLearnerId).toBe(ORPHAN_UUID);
    // The crux: no second canonical learner was minted.
    expect(createMock).not.toHaveBeenCalled();
    // And the link is durably persisted on the web profile.
    expect((await getLearner(web.id, T))?.identityLearnerId).toBe(ORPHAN_UUID);
  });

  it("creates a new identity learner when there is no orphan to reuse", async () => {
    const web = await createLearner({
      tenantId: T,
      parentUserId: PARENT,
      data: { firstName: "Sam", birthYear: 2015 },
    });

    listMock.mockResolvedValue({ ok: true, data: [] });
    createMock.mockResolvedValue({ ok: true, data: { learner: { id: NEW_UUID } } });

    const linked = await provisionAndLink("Bearer x", web, T, { parentUserId: PARENT });

    expect(linked.identityLearnerId).toBe(NEW_UUID);
    expect(createMock).toHaveBeenCalledTimes(1);
    expect((await getLearner(web.id, T))?.identityLearnerId).toBe(NEW_UUID);
  });

  it("does not reuse a same-named identity learner whose birth year differs (sibling guard)", async () => {
    const web = await createLearner({
      tenantId: T,
      parentUserId: PARENT,
      data: { firstName: "Casey", birthYear: 2016 },
    });

    // Same name, but a different child (born a different year) — must NOT be
    // reused; a new canonical learner is created instead.
    listMock.mockResolvedValue({
      ok: true,
      data: [{ id: ORPHAN_UUID, name: "Casey", dateOfBirth: "2012-04-01" }],
    });
    createMock.mockResolvedValue({ ok: true, data: { learner: { id: NEW_UUID } } });

    const linked = await provisionAndLink("Bearer x", web, T, { parentUserId: PARENT });

    expect(linked.identityLearnerId).toBe(NEW_UUID);
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("does not re-create when the same orphan name appears across two unlinked learners", async () => {
    // Two same-named unlinked web learners, one orphan identity learner: the
    // orphan is consumed once; the second falls through to a single create.
    const a = await createLearner({
      tenantId: T,
      parentUserId: PARENT,
      data: { firstName: "Jordan", birthYear: 2014 },
    });
    const b = await createLearner({
      tenantId: T,
      parentUserId: PARENT,
      data: { firstName: "Jordan", birthYear: 2018 },
    });

    listMock.mockResolvedValue({ ok: true, data: [{ id: ORPHAN_UUID, name: "Jordan" }] });
    createMock.mockResolvedValue({ ok: true, data: { learner: { id: NEW_UUID } } });

    const reuse = { candidates: [{ id: ORPHAN_UUID, name: "Jordan" }], linkedIds: new Set<string>() };
    const linkedA = await provisionAndLink("Bearer x", a, T, { reuse });
    const linkedB = await provisionAndLink("Bearer x", b, T, { reuse });

    const ids = [linkedA.identityLearnerId, linkedB.identityLearnerId];
    expect(ids).toContain(ORPHAN_UUID);
    expect(ids).toContain(NEW_UUID);
    // Only the unmatched learner triggered a create — the orphan was reused.
    expect(createMock).toHaveBeenCalledTimes(1);
  });
});
