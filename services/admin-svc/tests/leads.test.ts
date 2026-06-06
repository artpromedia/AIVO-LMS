/**
 * Lead lifecycle + CRM webhook tests.
 *
 * The pure parts (HMAC signing, fail-soft skip, transition map) and the
 * read/patch role guards run without a database — the guards reject before any
 * DB access, so a stub db suffices.
 */
import { test } from "node:test";
import assert from "node:assert";
import { createHmac } from "node:crypto";

test("signCrmPayload matches HMAC-SHA256 hex", async () => {
  const { signCrmPayload } = await import("../src/lib/crm-webhook.js");
  const body = JSON.stringify({ event: "lead.created", lead: { id: "1" } });
  const expected = createHmac("sha256", "shh").update(body).digest("hex");
  assert.equal(signCrmPayload(body, "shh"), expected);
});

test("deliverLeadToCrm is fail-soft and skips when CRM_WEBHOOK_URL is unset", async () => {
  const { deliverLeadToCrm } = await import("../src/lib/crm-webhook.js");
  delete process.env.CRM_WEBHOOK_URL;
  const log = { info() {}, warn() {}, error() {}, debug() {} } as any;
  const outcome = await deliverLeadToCrm(
    {
      id: "1",
      type: "demo",
      name: "Ada",
      email: "ada@example.com",
      company: null,
      role: null,
      message: null,
      source: "website",
      status: "new",
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      couponCode: null,
      createdAt: new Date().toISOString(),
    },
    log,
  );
  assert.equal(outcome, "skipped");
});

test("LEAD_TRANSITIONS: won/lost terminal; new→contacted allowed", async () => {
  const { LEAD_TRANSITIONS } = await import("../src/routes/leads.js");
  assert.deepEqual(LEAD_TRANSITIONS.won, []);
  assert.deepEqual(LEAD_TRANSITIONS.lost, []);
  assert.ok(LEAD_TRANSITIONS.new.includes("contacted"));
  assert.ok(!LEAD_TRANSITIONS.new.includes("won"));
});

const stubDb = { execute: async () => ({}) } as any;

async function bootstrap() {
  const Fastify = (await import("fastify")).default;
  const { signJWT } = await import("@aivo/security");
  const { registerLeadRoutes } = await import("../src/routes/leads.js");
  const app = Fastify();
  registerLeadRoutes(app, stubDb);
  await app.ready();
  const parentToken = await signJWT({
    sub: "u_parent",
    role: "PARENT",
    email: "parent@aivo.dev",
    tenantId: "t_demo",
    name: "Parent",
  } as any);
  return { app, parentToken };
}

test("lead read/patch reject missing token with 401", async () => {
  const { app } = await bootstrap();
  try {
    const cases: Array<["GET" | "PATCH", string]> = [
      ["GET", "/api/admin-svc/leads"],
      ["GET", "/api/admin-svc/leads/abc"],
      ["PATCH", "/api/admin-svc/leads/abc/status"],
    ];
    for (const [method, url] of cases) {
      const res = await app.inject({
        method,
        url,
        payload: method === "PATCH" ? { status: "contacted" } : undefined,
      });
      assert.equal(res.statusCode, 401, `${method} ${url}`);
    }
  } finally {
    await app.close();
  }
});

test("lead read/patch reject non-sales/non-admin with 403", async () => {
  const { app, parentToken } = await bootstrap();
  try {
    const cases: Array<["GET" | "PATCH", string]> = [
      ["GET", "/api/admin-svc/leads"],
      ["PATCH", "/api/admin-svc/leads/abc/status"],
    ];
    for (const [method, url] of cases) {
      const res = await app.inject({
        method,
        url,
        headers: { authorization: `Bearer ${parentToken}` },
        payload: method === "PATCH" ? { status: "contacted" } : undefined,
      });
      assert.equal(res.statusCode, 403, `${method} ${url}`);
    }
  } finally {
    await app.close();
  }
});
