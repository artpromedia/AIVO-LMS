/**
 * learners — memory == postgres parity (Sprint 1).
 * Create + parent scoping + update (displayName recompute) + delete cascade.
 */
import { it, expect } from "vitest";
import {
  createLearner,
  getLearner,
  listLearnersForParent,
  parentCanAccessLearner,
  updateLearner,
  deleteLearner,
  findPrimaryParentForLearner,
} from "@/lib/db/repos";
import { runInBothModes } from "./parity.harness";

const T = "t_demo";
const PARENT = "u_demo_parent";

runInBothModes("learners", () => {
  it("create links the parent and scopes reads", async () => {
    const created = await createLearner({
      tenantId: T,
      parentUserId: PARENT,
      data: { firstName: "Robin", birthYear: 2016 },
    });
    expect((await getLearner(created.id, T))?.firstName).toBe("Robin");
    expect(await parentCanAccessLearner(PARENT, created.id, T)).toBe(true);
    expect(await parentCanAccessLearner("u_other", created.id, T)).toBe(false);
    expect(await findPrimaryParentForLearner(created.id, T)).toBe(PARENT);

    const mine = await listLearnersForParent(PARENT, T);
    expect(mine.some((l) => l.id === created.id)).toBe(true);
    const theirs = await listLearnersForParent("u_other_parent", T);
    expect(theirs.some((l) => l.id === created.id)).toBe(false);
  });

  it("update recomputes displayName and delete cascades the relationship", async () => {
    const created = await createLearner({
      tenantId: T,
      parentUserId: PARENT,
      data: { firstName: "Sam", birthYear: 2015 },
    });
    const updated = await updateLearner(created.id, T, { firstName: "Sammy" });
    expect(updated?.firstName).toBe("Sammy");
    expect(updated?.displayName).toBe("Sammy");

    expect(await deleteLearner(created.id, T)).toBe(true);
    expect(await getLearner(created.id, T)).toBeNull();
    expect(await parentCanAccessLearner(PARENT, created.id, T)).toBe(false);
  });
});
