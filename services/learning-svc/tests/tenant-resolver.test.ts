import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { signJWT, initKeys } from "@aivo/security";
import { resolveTenantId } from "../src/lib/tenant.js";

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";
const LEARNER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

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

describe("learning-svc tenant resolver", () => {
  before(async () => {
    await initKeys();
  });

  it("returns tenantId from a valid JWT", async () => {
    const token = await signJWT({ sub: "user-1", tenantId: TENANT_A, role: "PARENT" });
    const req = makeRequest({ authorization: `Bearer ${token}` });
    const resolved = await resolveTenantId(req, makeDb(TENANT_B), LEARNER_ID);
    assert.equal(resolved, TENANT_A, "JWT tenant should win over DB tenant");
  });

  it("falls back to learner DB lookup when no JWT is present", async () => {
    const req = makeRequest({});
    const resolved = await resolveTenantId(req, makeDb(TENANT_B), LEARNER_ID);
    assert.equal(resolved, TENANT_B);
  });

  it("returns null when neither JWT nor learner record yield a tenant", async () => {
    const req = makeRequest({});
    const resolved = await resolveTenantId(req, makeDb(null), LEARNER_ID);
    assert.equal(resolved, null);
  });

  it("ignores invalid JWTs and falls back to DB", async () => {
    const req = makeRequest({ authorization: "Bearer not-a-real-token" });
    const resolved = await resolveTenantId(req, makeDb(TENANT_B), LEARNER_ID);
    assert.equal(resolved, TENANT_B);
  });
});
