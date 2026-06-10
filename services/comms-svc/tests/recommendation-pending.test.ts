/**
 * Sprint 5 — recommendation-pending notification:
 *   - template renders count/learner/deep-link correctly
 *   - internal route requires the service key
 *   - 24h digest suppression: a second notify for the same learner within
 *     24h returns "suppressed" and writes no second row
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { renderTemplate } from "../src/lib/templates.js";
import { registerNotificationRoutes } from "../src/routes/notifications.js";

const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY || "aivo-internal-dev-key";

test("recommendation_pending template renders singular and plural copy", () => {
  const single = renderTemplate("recommendation_pending", {
    learnerName: "Sky",
    count: 1,
    topTitle: "Raise delivery level — sustained mastery",
    reviewUrl: "https://app.example/parent/learners/l1#recommendations",
  });
  assert.match(single.subject, /A learning recommendation awaits your approval for Sky/);
  assert.match(single.html, /Raise delivery level/);
  assert.match(single.html, /#recommendations/);
  assert.match(single.text, /Nothing changes until you approve it|awaiting your approval/);

  const plural = renderTemplate("recommendation_pending", {
    learnerName: "Sky",
    count: 3,
    topTitle: "Raise delivery level — sustained mastery",
    reviewUrl: "https://app.example/x",
  });
  assert.match(plural.subject, /3 learning recommendations await your approval/);
});

/**
 * Recording fake of the Drizzle handle: `select` answers the suppression
 * lookup from `existingRows`; `insert` records the created notification.
 */
function fakeDb(existingRows: Array<{ id: string }>) {
  const inserted: Record<string, unknown>[] = [];
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => existingRows }),
      }),
    }),
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        inserted.push(v);
        return { returning: async () => [{ id: "n-1", ...v }] };
      },
    }),
  };
  return { db, inserted };
}

async function buildApp(db: unknown) {
  const app = Fastify({ logger: false });
  registerNotificationRoutes(app, db);
  await app.ready();
  return app;
}

const PAYLOAD = {
  parentId: "11111111-1111-1111-1111-111111111111",
  parentEmail: null,
  learnerId: "22222222-2222-2222-2222-222222222222",
  learnerName: "Sky",
  count: 2,
  topTitle: "Raise delivery level — sustained mastery",
};

test("internal route rejects a missing/wrong service key", async () => {
  const { db } = fakeDb([]);
  const app = await buildApp(db);
  const res = await app.inject({
    method: "POST",
    url: "/api/comms/internal/recommendation-pending",
    payload: PAYLOAD,
  });
  assert.equal(res.statusCode, 401);
  const res2 = await app.inject({
    method: "POST",
    url: "/api/comms/internal/recommendation-pending",
    headers: { "x-internal-key": "wrong" },
    payload: PAYLOAD,
  });
  assert.equal(res2.statusCode, 401);
  await app.close();
});

test("creates the in-app notification with the approval deep link", async () => {
  const { db, inserted } = fakeDb([]);
  const app = await buildApp(db);
  const res = await app.inject({
    method: "POST",
    url: "/api/comms/internal/recommendation-pending",
    headers: { "x-internal-key": INTERNAL_KEY },
    payload: PAYLOAD,
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().status, "created");
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0]!.template, "recommendation_pending");
  assert.equal(inserted[0]!.category, "recommendations");
  assert.match(String(inserted[0]!.title), /2 learning recommendations/);
  assert.equal(inserted[0]!.link, `/parent/learners/${PAYLOAD.learnerId}#recommendations`);
  await app.close();
});

test("suppresses a second notification within 24h (digest)", async () => {
  const { db, inserted } = fakeDb([{ id: "existing-notification" }]);
  const app = await buildApp(db);
  const res = await app.inject({
    method: "POST",
    url: "/api/comms/internal/recommendation-pending",
    headers: { "x-internal-key": INTERNAL_KEY },
    payload: PAYLOAD,
  });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { status: "suppressed", reason: "digest_24h" });
  assert.equal(inserted.length, 0);
  await app.close();
});

test("validates required fields", async () => {
  const { db } = fakeDb([]);
  const app = await buildApp(db);
  const res = await app.inject({
    method: "POST",
    url: "/api/comms/internal/recommendation-pending",
    headers: { "x-internal-key": INTERNAL_KEY },
    payload: { parentId: "p" },
  });
  assert.equal(res.statusCode, 400);
  await app.close();
});
