/**
 * identity — memory == postgres parity (Sprint 1).
 * Staff invite + lookup + tenant-scoped removal through the adapter.
 */
import { it, expect } from "vitest";
import { getPersistence } from "@/lib/db/persistence";
import { runInBothModes } from "./parity.harness";

const T = "t_demo";

runInBothModes("identity", () => {
  it("addStaffUser is readable by id and removeStaffUser is tenant-scoped", async () => {
    const identity = getPersistence().identity;
    const rec = await identity.addStaffUser({
      tenantId: T,
      email: "teach@example.com",
      displayName: "Pat Teacher",
      role: "TEACHER",
    });
    expect(rec.status).toBe("INVITED");

    const fetched = await identity.getUserById(rec.id);
    expect(fetched?.id).toBe(rec.id);

    // Wrong tenant cannot remove.
    expect(await identity.removeStaffUser(rec.id, "t_other")).toBe(false);
    expect((await identity.getUserById(rec.id))?.id).toBe(rec.id);

    // Correct tenant removes.
    expect(await identity.removeStaffUser(rec.id, T)).toBe(true);
    expect(await identity.getUserById(rec.id)).toBeNull();
  });

  it("updateUserDisplayName persists the new name", async () => {
    const identity = getPersistence().identity;
    const rec = await identity.addStaffUser({
      tenantId: T,
      email: "rename@example.com",
      displayName: "Before",
      role: "SCHOOL_ADMIN",
    });
    const updated = await identity.updateUserDisplayName(rec.id, "After");
    expect(updated?.displayName).toBe("After");
    expect((await identity.getUserById(rec.id))?.displayName).toBe("After");
  });
});
