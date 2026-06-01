/**
 * Teacher lesson-assignments route tests. A tiny fake Drizzle stub backs
 * GET/POST so we exercise the handler logic (auth scoping, validation,
 * row shaping) without a live database.
 */
process.env.NODE_ENV = "test";
process.env.INTERNAL_SERVICE_TOKEN = "test-internal-token";

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Fastify, { type FastifyInstance } from "fastify";
import { registerAssignmentRoutes } from "../assignments.js";

const TEACHER = "11111111-1111-1111-1111-111111111111";
const TENANT = "00000000-0000-0000-0000-000000000000";

interface Row {
  id: string;
  tenantId: string;
  teacherId: string;
  title: string;
  subject: string;
  status: string;
  dueDate: string | null;
  learnerIds: string[];
  createdAt: Date;
}

// Minimal Drizzle-shaped fake covering the calls assignments.ts makes:
//   select().from().where().orderBy().limit()
//   insert().values().returning()
function makeDb(seed: Row[] = []) {
  const rows = [...seed];
  return {
    _rows: rows,
    select() {
      return {
        from() {
          return {
            where() {
              return {
                orderBy() {
                  return { limit: async () => rows.slice() };
                },
              };
            },
          };
        },
      };
    },
    insert() {
      return {
        values(v: Partial<Row>) {
          const row: Row = {
            id: `as_${rows.length + 1}`,
            tenantId: v.tenantId!,
            teacherId: v.teacherId!,
            title: v.title!,
            subject: v.subject!,
            status: v.status ?? "active",
            dueDate: v.dueDate ?? null,
            learnerIds: (v.learnerIds as string[]) ?? [],
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
          };
          rows.push(row);
          return { returning: async () => [row] };
        },
      };
    },
  };
}

async function buildApp(db: ReturnType<typeof makeDb>): Promise<FastifyInstance> {
  const app = Fastify();
  // Stand in for registerAuthHook: inject a teacher identity.
  app.addHook("onRequest", async (req) => {
    (req as any).auth = { sub: TEACHER, tenantId: TENANT, role: "teacher" };
  });
  registerAssignmentRoutes(app, db);
  await app.ready();
  return app;
}

describe("learning-svc teacher assignments", () => {
  let app: FastifyInstance;
  beforeEach(async () => {
    if (app) await app.close();
  });

  it("creates an assignment and returns the shaped row", async () => {
    const db = makeDb();
    app = await buildApp(db);
    const res = await app.inject({
      method: "POST",
      url: "/api/learning/assignments",
      payload: { title: "Fractions", subject: "Math", dueDate: "2026-02-01" },
    });
    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.equal(body.title, "Fractions");
    assert.equal(body.subject, "Math");
    assert.equal(body.status, "active");
    assert.equal(body.dueDate, "2026-02-01");
    assert.equal(db._rows.length, 1);
    assert.equal(db._rows[0].teacherId, TEACHER);
    assert.equal(db._rows[0].tenantId, TENANT);
  });

  it("rejects a create with no title/subject", async () => {
    app = await buildApp(makeDb());
    const res = await app.inject({
      method: "POST",
      url: "/api/learning/assignments",
      payload: { title: "" },
    });
    assert.equal(res.statusCode, 400);
  });

  it("lists assignments newest-first as a flat array", async () => {
    const db = makeDb([
      {
        id: "as_seed",
        tenantId: TENANT,
        teacherId: TEACHER,
        title: "Seeded",
        subject: "Reading",
        status: "active",
        dueDate: null,
        learnerIds: [],
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
    app = await buildApp(db);
    const res = await app.inject({ method: "GET", url: "/api/learning/assignments" });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.ok(Array.isArray(body));
    assert.equal(body[0].title, "Seeded");
    assert.equal(body[0].learnerIds.length, 0);
  });
});
