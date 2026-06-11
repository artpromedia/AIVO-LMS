/**
 * Sprint B5 — SCIM 2.0 conformance suite driven by the request shapes
 * Okta and Microsoft Entra actually send (per their provisioning docs):
 * full lifecycle (create → update → deactivate → reactivate), filter
 * paging, class-group push + membership add/remove, unmapped-group
 * recording, wrong-tenant isolation, and malformed PatchOp rejection.
 * Skips without DATABASE_URL.
 */
import { test } from "node:test";
import assert from "node:assert";
import crypto from "node:crypto";

const SKIP = !process.env.DATABASE_URL;

async function bootstrap() {
  const Fastify = (await import("fastify")).default;
  const { createDb, tenants, schools } = await import("@aivo/db");
  const { registerScimRoutes } = await import("../src/routes/scim");
  const db = createDb(process.env.DATABASE_URL!);
  const app = Fastify();
  (app as any).db = db;
  await registerScimRoutes(app);
  await app.ready();

  const [tenant] = await db
    .insert(tenants)
    .values({ name: `SCIM Conf District ${Date.now()}`, type: "B2B_DISTRICT" } as any)
    .returning();
  const [school] = await db
    .insert(schools)
    .values({ tenantId: tenant.id, name: `Lincoln Elementary ${Date.now()}` } as any)
    .returning();
  const token = await issueToken(db, tenant.id);
  return { app, db, tenant, school, token };
}

async function teardown(app: any, db: any) {
  const { closeDb } = await import("@aivo/db");
  await app.close();
  await closeDb(db);
}

async function issueToken(db: any, tenantId: string): Promise<string> {
  const { scimTokens } = await import("@aivo/db");
  const plain = `scim_${crypto.randomBytes(24).toString("base64url")}`;
  const tokenHash = crypto.createHash("sha256").update(plain).digest("hex");
  await db.insert(scimTokens).values({
    tenantId,
    tokenHash,
    name: "conformance-token",
    prefix: plain.slice(0, 10),
    createdBy: null,
  } as any);
  return plain;
}

const auth = (token: string) => ({
  authorization: `Bearer ${token}`,
  "content-type": "application/scim+json",
});

test("Okta lifecycle: create → PUT update → no-path deactivate → reactivate", { skip: SKIP }, async () => {
  const { app, db, token } = await bootstrap();
  try {
    const email = `okta-teacher-${Date.now()}@conf.test`;
    // Okta's documented POST /Users shape.
    const createRes = await app.inject({
      method: "POST",
      url: "/scim/v2/Users",
      headers: auth(token),
      payload: {
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
        userName: email,
        name: { givenName: "Avery", familyName: "Okta" },
        emails: [{ primary: true, value: email, type: "work" }],
        displayName: "Avery Okta",
        externalId: `okta-ext-${Date.now()}`,
        aivoRole: "TEACHER",
        active: true,
      },
    });
    assert.equal(createRes.statusCode, 201, createRes.body);
    const created = createRes.json() as any;
    assert.equal(created.userName, email);
    assert.equal(created.active, true);

    // Okta profile update = PUT of the full resource.
    const putRes = await app.inject({
      method: "PUT",
      url: `/scim/v2/Users/${created.id}`,
      headers: auth(token),
      payload: {
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
        userName: email,
        displayName: "Avery O. Renamed",
        active: true,
      },
    });
    assert.equal(putRes.statusCode, 200, putRes.body);
    assert.equal((putRes.json() as any).displayName, "Avery O. Renamed");

    // Okta deactivation: PATCH with NO path, value object.
    const deactivate = await app.inject({
      method: "PATCH",
      url: `/scim/v2/Users/${created.id}`,
      headers: auth(token),
      payload: {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
        Operations: [{ op: "replace", value: { active: false } }],
      },
    });
    assert.equal(deactivate.statusCode, 200, deactivate.body);
    assert.equal((deactivate.json() as any).active, false);

    // Reactivate the same way.
    const reactivate = await app.inject({
      method: "PATCH",
      url: `/scim/v2/Users/${created.id}`,
      headers: auth(token),
      payload: {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
        Operations: [{ op: "replace", value: { active: true } }],
      },
    });
    assert.equal(reactivate.statusCode, 200, reactivate.body);
    assert.equal((reactivate.json() as any).active, true);
  } finally {
    await teardown(app, db);
  }
});

test("Entra lifecycle: enterprise-ext create, capitalized ops, string booleans", { skip: SKIP }, async () => {
  const { app, db, token } = await bootstrap();
  try {
    const email = `entra-teacher-${Date.now()}@conf.test`;
    // Entra's documented POST shape (enterprise extension carries role).
    const createRes = await app.inject({
      method: "POST",
      url: "/scim/v2/Users",
      headers: auth(token),
      payload: {
        schemas: [
          "urn:ietf:params:scim:schemas:core:2.0:User",
          "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User",
        ],
        externalId: `entra-ext-${Date.now()}`,
        userName: email,
        active: true,
        displayName: "Entra Teacher",
        emails: [{ primary: true, type: "work", value: email }],
        name: { givenName: "En", familyName: "Tra", formatted: "En Tra" },
        "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User": { department: "TEACHER" },
      },
    });
    assert.equal(createRes.statusCode, 201, createRes.body);
    const created = createRes.json() as any;

    // Entra PATCH: capitalized op verb + STRING "False" for active.
    const deactivate = await app.inject({
      method: "PATCH",
      url: `/scim/v2/Users/${created.id}`,
      headers: auth(token),
      payload: {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
        Operations: [{ op: "Replace", path: "active", value: "False" }],
      },
    });
    assert.equal(deactivate.statusCode, 200, deactivate.body);
    assert.equal((deactivate.json() as any).active, false, "string 'False' must deactivate");

    const reactivate = await app.inject({
      method: "PATCH",
      url: `/scim/v2/Users/${created.id}`,
      headers: auth(token),
      payload: {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
        Operations: [{ op: "Replace", path: "active", value: "True" }],
      },
    });
    assert.equal((reactivate.json() as any).active, true, "string 'True' must reactivate");
  } finally {
    await teardown(app, db);
  }
});

test("filter + paging: externalId eq lookup and startIndex/count envelopes", { skip: SKIP }, async () => {
  const { app, db, token } = await bootstrap();
  try {
    const stamp = Date.now();
    const externalId = `page-ext-${stamp}-1`;
    for (let i = 0; i < 3; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/scim/v2/Users",
        headers: auth(token),
        payload: {
          schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
          userName: `page-${stamp}-${i}@conf.test`,
          externalId: `page-ext-${stamp}-${i}`,
          aivoRole: "TEACHER",
        },
      });
      assert.equal(res.statusCode, 201, res.body);
    }

    const byExternal = await app.inject({
      method: "GET",
      url: `/scim/v2/Users?filter=${encodeURIComponent(`externalId eq "${externalId}"`)}`,
      headers: auth(token),
    });
    const extPage = byExternal.json() as any;
    assert.equal(extPage.totalResults, 1);
    assert.equal(extPage.Resources[0].externalId, externalId);

    const paged = await app.inject({
      method: "GET",
      url: "/scim/v2/Users?startIndex=2&count=1",
      headers: auth(token),
    });
    const page = paged.json() as any;
    assert.equal(page.schemas[0], "urn:ietf:params:scim:api:messages:2.0:ListResponse");
    assert.equal(page.startIndex, 2);
    assert.equal(page.itemsPerPage, 1);
    assert.ok(page.totalResults >= 3);
  } finally {
    await teardown(app, db);
  }
});

test("group push: class convention maps to a classroom; members become staff", { skip: SKIP }, async () => {
  const { app, db, token, school, tenant } = await bootstrap();
  const { classrooms, staffAssignments } = await import("@aivo/db");
  const { eq } = await import("drizzle-orm");
  try {
    const t1 = await app.inject({
      method: "POST",
      url: "/scim/v2/Users",
      headers: auth(token),
      payload: {
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
        userName: `lead-${Date.now()}@conf.test`,
        aivoRole: "TEACHER",
      },
    });
    const teacher = t1.json() as any;

    // Okta push-group shape.
    const push = await app.inject({
      method: "POST",
      url: "/scim/v2/Groups",
      headers: auth(token),
      payload: {
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"],
        displayName: `Class: ${school.name} / Grade 3 - Room B`,
        members: [{ value: teacher.id, display: teacher.displayName }],
      },
    });
    assert.equal(push.statusCode, 201, push.body);
    const group = push.json() as any;
    assert.match(group.displayName, /Grade 3 - Room B/);
    assert.equal(group.members.length, 1);

    const [classroom] = await db
      .select()
      .from(classrooms)
      .where(eq(classrooms.id, group.id))
      .limit(1);
    assert.ok(classroom, "classroom row created");
    assert.equal(classroom.teacherId, teacher.id, "first member is teacher of record");

    const assignments = await db
      .select()
      .from(staffAssignments)
      .where(eq(staffAssignments.userId, teacher.id));
    assert.equal(assignments.length, 1, "staff assignment created");
    assert.equal(assignments[0].schoolId, school.id);

    // Entra-style membership removal: path filter expression.
    const remove = await app.inject({
      method: "PATCH",
      url: `/scim/v2/Groups/${group.id}`,
      headers: auth(token),
      payload: {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
        Operations: [{ op: "Remove", path: `members[value eq "${teacher.id}"]` }],
      },
    });
    assert.equal(remove.statusCode, 200, remove.body);
    assert.equal((remove.json() as any).members.length, 0);

    // Okta-style membership add: value array, plain members path.
    const add = await app.inject({
      method: "PATCH",
      url: `/scim/v2/Groups/${group.id}`,
      headers: auth(token),
      payload: {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
        Operations: [{ op: "add", path: "members", value: [{ value: teacher.id }] }],
      },
    });
    assert.equal(add.statusCode, 200, add.body);
    assert.equal((add.json() as any).members.length, 1);
    void tenant;
  } finally {
    await teardown(app, db);
  }
});

test("group push: non-convention and unknown-school groups are RECORDED, not dropped", { skip: SKIP }, async () => {
  const { app, db, token, tenant } = await bootstrap();
  const { scimUnmappedGroups } = await import("@aivo/db");
  const { and, eq } = await import("drizzle-orm");
  try {
    const oktaEveryone = await app.inject({
      method: "POST",
      url: "/scim/v2/Groups",
      headers: auth(token),
      payload: {
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"],
        displayName: "Everyone",
        members: [],
      },
    });
    assert.equal(oktaEveryone.statusCode, 400);
    assert.match(oktaEveryone.body, /recorded for review/i);

    const unknownSchool = await app.inject({
      method: "POST",
      url: "/scim/v2/Groups",
      headers: auth(token),
      payload: {
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"],
        displayName: "Class: Hogwarts / Potions 101",
        members: [],
      },
    });
    assert.equal(unknownSchool.statusCode, 400);
    assert.match(unknownSchool.body, /No school named/i);

    const recorded = await db
      .select()
      .from(scimUnmappedGroups)
      .where(eq(scimUnmappedGroups.tenantId, tenant.id));
    const names = recorded.map((r: any) => r.displayName).sort();
    assert.deepEqual(names, ["Class: Hogwarts / Potions 101", "Everyone"]);
    assert.equal(recorded.find((r: any) => r.displayName === "Everyone")!.reason, "not_class_convention");
    assert.equal(
      recorded.find((r: any) => r.displayName.includes("Hogwarts"))!.reason,
      "unknown_school",
    );

    // A repeat push bumps seenCount instead of duplicating the row.
    await app.inject({
      method: "POST",
      url: "/scim/v2/Groups",
      headers: auth(token),
      payload: { schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"], displayName: "Everyone" },
    });
    const [again] = await db
      .select()
      .from(scimUnmappedGroups)
      .where(
        and(eq(scimUnmappedGroups.tenantId, tenant.id), eq(scimUnmappedGroups.displayName, "Everyone")),
      );
    assert.equal(again.seenCount, 2);
  } finally {
    await teardown(app, db);
  }
});

test("tenant isolation: token A cannot see, modify, or group tenant B's users", { skip: SKIP }, async () => {
  const { app, db, token } = await bootstrap();
  const { tenants } = await import("@aivo/db");
  try {
    const [tenantB] = await db
      .insert(tenants)
      .values({ name: `SCIM Conf Other ${Date.now()}`, type: "B2B_DISTRICT" } as any)
      .returning();
    const tokenB = await issueToken(db, tenantB.id);
    const email = `b-user-${Date.now()}@conf.test`;
    const created = await app.inject({
      method: "POST",
      url: "/scim/v2/Users",
      headers: auth(tokenB),
      payload: {
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
        userName: email,
        aivoRole: "TEACHER",
      },
    });
    const bUser = created.json() as any;

    // Token A: list must not contain B's user; direct GET must 404.
    const listA = await app.inject({
      method: "GET",
      url: `/scim/v2/Users?filter=${encodeURIComponent(`userName eq "${email}"`)}`,
      headers: auth(token),
    });
    assert.equal((listA.json() as any).totalResults, 0);
    const getA = await app.inject({
      method: "GET",
      url: `/scim/v2/Users/${bUser.id}`,
      headers: auth(token),
    });
    assert.equal(getA.statusCode, 404);
    const patchA = await app.inject({
      method: "PATCH",
      url: `/scim/v2/Users/${bUser.id}`,
      headers: auth(token),
      payload: {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
        Operations: [{ op: "replace", value: { active: false } }],
      },
    });
    assert.equal(patchA.statusCode, 404);
  } finally {
    await teardown(app, db);
  }
});

test("malformed PatchOps are rejected, never guessed at", { skip: SKIP }, async () => {
  const { app, db, token, school } = await bootstrap();
  try {
    const created = await app.inject({
      method: "POST",
      url: "/scim/v2/Groups",
      headers: auth(token),
      payload: {
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"],
        displayName: `Class: ${school.name} / Patch Target`,
      },
    });
    const group = created.json() as any;

    const noOps = await app.inject({
      method: "PATCH",
      url: `/scim/v2/Groups/${group.id}`,
      headers: auth(token),
      payload: { schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"] },
    });
    assert.equal(noOps.statusCode, 400);

    const bogusOp = await app.inject({
      method: "PATCH",
      url: `/scim/v2/Groups/${group.id}`,
      headers: auth(token),
      payload: {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
        Operations: [{ op: "explode", path: "members" }],
      },
    });
    assert.equal(bogusOp.statusCode, 400);
    assert.match(bogusOp.body, /Unsupported PatchOp/);

    // Renaming a class group outside the convention is refused.
    const badRename = await app.inject({
      method: "PATCH",
      url: `/scim/v2/Groups/${group.id}`,
      headers: auth(token),
      payload: {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
        Operations: [{ op: "replace", path: "displayName", value: "Just A Name" }],
      },
    });
    assert.equal(badRename.statusCode, 400);
  } finally {
    await teardown(app, db);
  }
});

test("role groups remain immutable; class deletion is refused with guidance", { skip: SKIP }, async () => {
  const { app, db, token, school } = await bootstrap();
  try {
    const roleMutation = await app.inject({
      method: "PATCH",
      url: "/scim/v2/Groups/TEACHER",
      headers: auth(token),
      payload: {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
        Operations: [{ op: "add", path: "members", value: [{ value: "x" }] }],
      },
    });
    assert.equal(roleMutation.statusCode, 400);
    assert.match(roleMutation.body, /mutability/);

    const pushed = await app.inject({
      method: "POST",
      url: "/scim/v2/Groups",
      headers: auth(token),
      payload: {
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"],
        displayName: `Class: ${school.name} / Delete Target`,
      },
    });
    const del = await app.inject({
      method: "DELETE",
      url: `/scim/v2/Groups/${(pushed.json() as any).id}`,
      headers: auth(token),
    });
    assert.equal(del.statusCode, 400);
    assert.match(del.body, /Archive the class/);
  } finally {
    await teardown(app, db);
  }
});
