import { describe, expect, it } from "vitest";
import { dedupeContacts, type MessageContact } from "./contacts";

function c(p: Partial<MessageContact> & { userId: string; learnerId: string }): MessageContact {
  return {
    userId: p.userId,
    learnerId: p.learnerId,
    displayName: p.displayName ?? "Member",
    role: p.role ?? "teacher",
    learnerName: p.learnerName ?? "Learner",
  };
}

describe("dedupeContacts", () => {
  it("collapses duplicate (userId, learnerId) pairs", () => {
    const out = dedupeContacts([
      c({ userId: "u1", learnerId: "l1" }),
      c({ userId: "u1", learnerId: "l1" }),
    ]);
    expect(out).toHaveLength(1);
  });

  it("keeps the same user as a separate contact per learner", () => {
    const out = dedupeContacts([
      c({ userId: "u1", learnerId: "l1", learnerName: "Ada" }),
      c({ userId: "u1", learnerId: "l2", learnerName: "Ben" }),
    ]);
    expect(out).toHaveLength(2);
  });

  it("sorts by learner, then name, then role (deterministic)", () => {
    const out = dedupeContacts([
      c({ userId: "u2", learnerId: "l2", learnerName: "Ben", displayName: "Zoe" }),
      c({ userId: "u1", learnerId: "l1", learnerName: "Ada", displayName: "Tom" }),
      c({ userId: "u3", learnerId: "l1", learnerName: "Ada", displayName: "Amy" }),
    ]);
    expect(out.map((x) => x.displayName)).toEqual(["Amy", "Tom", "Zoe"]);
  });

  it("returns an empty array for no contacts", () => {
    expect(dedupeContacts([])).toEqual([]);
  });
});
