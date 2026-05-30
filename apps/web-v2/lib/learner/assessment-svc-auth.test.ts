import { describe, it, expect } from "vitest";
import { verifyJWT } from "@aivo/security";
import { mintAssessmentSvcToken } from "./assessment-svc-auth";

describe("mintAssessmentSvcToken", () => {
  it("mints a learner-scoped token that verifies with sub + LEARNER role", async () => {
    const token = await mintAssessmentSvcToken({ userId: "user-1", role: "learner" });
    expect(typeof token).toBe("string");
    const payload = (await verifyJWT(token!)) as { sub?: string; role?: string };
    expect(payload.sub).toBe("user-1");
    expect(payload.role).toBe("LEARNER");
  });

  it("maps a parent session to the PARENT principal", async () => {
    const token = await mintAssessmentSvcToken({ userId: "parent-9", role: "parent" });
    const payload = (await verifyJWT(token!)) as { sub?: string; role?: string };
    expect(payload.sub).toBe("parent-9");
    expect(payload.role).toBe("PARENT");
  });

  it("returns null for roles with no assessment-svc principal", async () => {
    expect(await mintAssessmentSvcToken({ userId: "u", role: "platform_admin" })).toBeNull();
    expect(await mintAssessmentSvcToken({ userId: "u", role: "teacher" })).toBeNull();
  });
});
