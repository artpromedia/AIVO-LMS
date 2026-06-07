import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { verifyTeacherAccess } from "../src/auth.js";

const TEACHER = "11111111-1111-1111-8111-111111111111";
const LEARNER = "22222222-2222-2222-8222-222222222222";

/** Fake drizzle chain whose terminal `.limit()` resolves to `rows`. */
function fakeDb(rows: unknown[]) {
  const chain: any = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    limit: async () => rows,
  };
  return chain;
}

/** db whose use throws — proves the guard short-circuits before any query. */
function explodingDb() {
  return {
    select() {
      throw new Error("db should not be touched");
    },
  } as any;
}

describe("verifyTeacherAccess", () => {
  it("returns false for non-UUID inputs without querying the db", async () => {
    assert.equal(await verifyTeacherAccess(explodingDb(), "not-a-uuid", LEARNER), false);
    assert.equal(await verifyTeacherAccess(explodingDb(), TEACHER, "nope"), false);
  });

  it("returns true when an ACCEPTED learner_teachers row exists", async () => {
    const db = fakeDb([{ id: "lt_1", status: "ACCEPTED" }]);
    assert.equal(await verifyTeacherAccess(db, TEACHER, LEARNER), true);
  });

  it("returns false when no link row is found", async () => {
    const db = fakeDb([]);
    assert.equal(await verifyTeacherAccess(db, TEACHER, LEARNER), false);
  });

  it("returns false (does not throw) when the query rejects", async () => {
    const db: any = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => {
              throw new Error("connection lost");
            },
          }),
        }),
      }),
    };
    assert.equal(await verifyTeacherAccess(db, TEACHER, LEARNER), false);
  });
});
