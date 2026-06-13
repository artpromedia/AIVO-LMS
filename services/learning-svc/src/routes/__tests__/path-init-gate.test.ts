/**
 * Sprint C-12 (ADR 0042) — the SERVICES HALF of the cross-stack teach gate.
 *
 * Proves the EXPLICIT services-side gate: the learning-svc path-init route
 * (`POST /api/learning/path/:learnerId/:subject/init`) refuses to initialise a
 * learning path for a child whose brain is not approved/amended, REGARDLESS of
 * caller — internal-token callers (brain-svc, schedulers, integrations)
 * included. Before C-12 this was implicit-by-sequencing: any other caller would
 * have initialised a path for an unapproved child and nothing caught it.
 *
 * Paired with the web half (apps/web-v2/lib/db/__tests__/lesson-gate.brain-approval.test.ts):
 * together they are the cross-stack teach-gate integration proof — UNAPPROVED
 * is refused on BOTH pipelines, APPROVED proceeds on both. Both assert the same
 * `{approved, amended}` teaching set via the shared `canTeach` contract.
 *
 * learning-svc tests run entirely in-memory (no live Postgres): the DB is a
 * table-aware stub. Same Fastify `.inject()` harness as sessions.degraded.test.ts.
 */
process.env.NODE_ENV = "test";
process.env.INTERNAL_SERVICE_TOKEN = "test-internal-token";
process.env.BRAIN_SVC_URL = "http://brain.test.invalid";

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import Fastify, { type FastifyInstance } from "fastify";
import { canTeach, brainStates, learners, learningPaths } from "@aivo/db";

// The approved path best-effort-calls brain-svc for personalized topics
// (`fetchPersonalizedTopics`), which swallows errors and returns null. Stub
// fetch so the test never makes a real network call (fast + hermetic).
const originalFetch = globalThis.fetch;
before(() => {
  globalThis.fetch = (async () => {
    throw new Error("ECONNREFUSED (stubbed)");
  }) as typeof fetch;
});
after(() => {
  globalThis.fetch = originalFetch;
});

const LEARNER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const TENANT_ID = "00000000-0000-0000-0000-000000000000";

const INTERNAL_HEADERS = {
  "x-internal-service": "brain-svc",
  "x-service-token": "test-internal-token",
  "content-type": "application/json",
} as const;

/** Resolve a drizzle pg-table's SQL name (the discriminator for the stub). */
function tableName(table: unknown): string {
  const sym = Object.getOwnPropertySymbols(table as object).find((s) =>
    String(s).includes("drizzle:Name"),
  );
  return sym ? ((table as Record<symbol, unknown>)[sym] as string) : "";
}

/**
 * A table-aware DB stub. `requireLearnerAccess` selects `learners` (needs a
 * tenantId row), the gate selects `brain_states` (we control approvalStatus),
 * and the handler selects/inserts `learning_paths`. Returns the row set keyed
 * by which table the query reads.
 */
function makeDb(opts: { approvalStatus: string | null; existingPath?: boolean }) {
  return {
    select() {
      let table = "";
      const chain: any = {
        from(t: unknown) {
          table = tableName(t);
          return chain;
        },
        where() {
          return chain;
        },
        orderBy() {
          // brain_states query ends with .orderBy(...) and is awaited.
          if (table === tableName(brainStates)) {
            return Promise.resolve(
              opts.approvalStatus === null
                ? []
                : [{ approvalStatus: opts.approvalStatus }],
            );
          }
          return Promise.resolve([]);
        },
        // `learners` (requireLearnerAccess) and `learning_paths` (existence
        // check) are awaited directly off `.where(...)` — make the chain
        // thenable so `await db.select()...where(...)` resolves.
        then(resolve: (v: unknown) => void) {
          if (table === tableName(learners)) {
            resolve([{ tenantId: TENANT_ID }]);
          } else if (table === tableName(learningPaths)) {
            resolve(opts.existingPath ? [{ id: "lp_1", subject: "math" }] : []);
          } else {
            resolve([]);
          }
        },
      };
      return chain;
    },
    insert() {
      return {
        values(v: any) {
          return { returning: async () => [{ id: "lp_new", ...v }] };
        },
      };
    },
    update() {
      return { set: () => ({ where: () => ({ returning: async () => [{ id: "lp_new" }] }) }) };
    },
  } as any;
}

let registerSessionRoutes: (app: FastifyInstance, db: any) => void;

before(async () => {
  ({ registerSessionRoutes } = await import("../sessions.js"));
});

async function buildApp(db: any): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  registerSessionRoutes(app, db);
  await app.ready();
  return app;
}

async function initPath(app: FastifyInstance) {
  return app.inject({
    method: "POST",
    url: `/api/learning/path/${LEARNER_ID}/math/init`,
    headers: INTERNAL_HEADERS,
    payload: { functioning_level: "STANDARD" },
  });
}

describe("learning-svc path-init — explicit teach gate (ADR 0042, services half)", () => {
  it("the teaching set is exactly {approved, amended} (shared contract)", () => {
    assert.ok(canTeach("approved"));
    assert.ok(canTeach("amended"));
    assert.ok(!canTeach("pending_parent_review"));
    assert.ok(!canTeach("declined"));
    assert.ok(!canTeach(null));
  });

  it("UNAPPROVED (pending_parent_review) → 403 brain_not_approved, NO path created", async () => {
    const app = await buildApp(makeDb({ approvalStatus: "pending_parent_review" }));
    try {
      const res = await initPath(app);
      assert.equal(res.statusCode, 403, res.payload);
      const body = res.json() as { code: string; approvalStatus: string };
      assert.equal(body.code, "brain_not_approved");
      assert.equal(body.approvalStatus, "pending_parent_review");
    } finally {
      await app.close();
    }
  });

  it("DECLINED → 403 brain_not_approved (declined never teaches)", async () => {
    const app = await buildApp(makeDb({ approvalStatus: "declined" }));
    try {
      const res = await initPath(app);
      assert.equal(res.statusCode, 403, res.payload);
      assert.equal((res.json() as { code: string }).code, "brain_not_approved");
    } finally {
      await app.close();
    }
  });

  it("NO brain row at all → 403 (fail-closed)", async () => {
    const app = await buildApp(makeDb({ approvalStatus: null }));
    try {
      const res = await initPath(app);
      assert.equal(res.statusCode, 403, res.payload);
      assert.equal((res.json() as { code: string }).code, "brain_not_approved");
    } finally {
      await app.close();
    }
  });

  it("APPROVED → path init proceeds (200/created)", async () => {
    const app = await buildApp(makeDb({ approvalStatus: "approved" }));
    try {
      const res = await initPath(app);
      assert.equal(res.statusCode, 200, res.payload);
      const body = res.json() as { status: string };
      assert.equal(body.status, "created");
    } finally {
      await app.close();
    }
  });

  it("AMENDED → path init proceeds (an amendment teaches)", async () => {
    const app = await buildApp(makeDb({ approvalStatus: "amended" }));
    try {
      const res = await initPath(app);
      assert.equal(res.statusCode, 200, res.payload);
      assert.equal((res.json() as { status: string }).status, "created");
    } finally {
      await app.close();
    }
  });

  it("APPROVED + existing path → already_exists (gate passed, then idempotent)", async () => {
    const app = await buildApp(makeDb({ approvalStatus: "approved", existingPath: true }));
    try {
      const res = await initPath(app);
      assert.equal(res.statusCode, 200, res.payload);
      assert.equal((res.json() as { status: string }).status, "already_exists");
    } finally {
      await app.close();
    }
  });
});
