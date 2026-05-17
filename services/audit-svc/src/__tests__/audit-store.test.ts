import { describe, expect, it } from "vitest";
import { InMemoryAuditStore } from "../services/audit-store.js";

describe("InMemoryAuditStore", () => {
  it("appends an event and redacts sensitive metadata", async () => {
    const store = new InMemoryAuditStore();
    const record = await store.append({
      actorRole: "parent",
      action: "profile_recommendation_approved",
      resourceType: "profile_recommendation",
      resourceId: "rec-1",
      learnerId: "l1",
      metadata: { parentPrivateNotes: "private", harmless: "ok" },
    });
    expect(record.metadata.parentPrivateNotes).toBe("[redacted]");
    expect(record.metadata.harmless).toBe("ok");
    expect(record.action).toBe("profile_recommendation_approved");
  });

  it("filters events by learnerId and action", async () => {
    const store = new InMemoryAuditStore();
    await store.append({
      actorRole: "parent",
      action: "profile_recommendation_approved",
      resourceType: "profile_recommendation",
      learnerId: "l1",
    });
    await store.append({
      actorRole: "parent",
      action: "profile_recommendation_amended",
      resourceType: "profile_recommendation",
      learnerId: "l1",
    });
    await store.append({
      actorRole: "parent",
      action: "profile_recommendation_approved",
      resourceType: "profile_recommendation",
      learnerId: "l2",
    });
    const filtered = await store.list({
      learnerId: "l1",
      action: "profile_recommendation_approved",
    });
    expect(filtered).toHaveLength(1);
  });

  it("counts events by action", async () => {
    const store = new InMemoryAuditStore();
    await store.append({
      actorRole: "parent",
      action: "profile_recommendation_approved",
      resourceType: "profile_recommendation",
    });
    await store.append({
      actorRole: "parent",
      action: "profile_recommendation_approved",
      resourceType: "profile_recommendation",
    });
    await store.append({
      actorRole: "parent",
      action: "deletion_requested",
      resourceType: "learner",
    });
    const counts = await store.countByAction();
    expect(counts.profile_recommendation_approved).toBe(2);
    expect(counts.deletion_requested).toBe(1);
  });
});
