import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { signJWT, initKeys } from "@aivo/security";
import { resolveTenantIdForLearner, resolveTenantIdForUser } from "../src/lib/tenant.js";

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";
const LEARNER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function makeRequest(headers: Record<string, string> = {}): any {
  return { headers };
}

function makeDb(tenantId: string | null) {
  return {
    select() {
      return {
        from() {
          return {
            where: async () => (tenantId ? [{ tenantId }] : []),
          };
        },
      };
    },
  } as any;
}

describe("tutor-svc tenant resolver", () => {
  before(async () => {
    await initKeys();
  });

  it("learner resolver: returns JWT tenantId", async () => {
    const token = await signJWT({ sub: "user-1", tenantId: TENANT_A, role: "PARENT" });
    const req = makeRequest({ authorization: `Bearer ${token}` });
    const resolved = await resolveTenantIdForLearner(req, makeDb(TENANT_B), LEARNER_ID);
    assert.equal(resolved, TENANT_A);
  });

  it("learner resolver: falls back to learner DB lookup", async () => {
    const req = makeRequest({});
    const resolved = await resolveTenantIdForLearner(req, makeDb(TENANT_B), LEARNER_ID);
    assert.equal(resolved, TENANT_B);
  });

  it("learner resolver: returns null when nothing resolves", async () => {
    const req = makeRequest({});
    const resolved = await resolveTenantIdForLearner(req, makeDb(null), LEARNER_ID);
    assert.equal(resolved, null);
  });

  it("user resolver: JWT wins over user DB lookup", async () => {
    const token = await signJWT({ sub: USER_ID, tenantId: TENANT_A, role: "PARENT" });
    const req = makeRequest({ authorization: `Bearer ${token}` });
    const resolved = await resolveTenantIdForUser(req, makeDb(TENANT_B), USER_ID, TENANT_B);
    assert.equal(resolved, TENANT_A);
  });

  it("user resolver: body tenantId is ignored to prevent spoofing", async () => {
    const req = makeRequest({});
    const resolved = await resolveTenantIdForUser(req, makeDb(null), USER_ID, TENANT_A);
    assert.equal(resolved, null, "Body tenantId must NOT be trusted");
  });

  it("user resolver: returns null when nothing resolves", async () => {
    const req = makeRequest({});
    const resolved = await resolveTenantIdForUser(req, makeDb(null), USER_ID, undefined);
    assert.equal(resolved, null);
  });
});
