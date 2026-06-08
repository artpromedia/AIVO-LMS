/**
 * Seed parity (Sprint 0) — proves the Postgres seed lands the same
 * reference rows the in-memory seed produces, and that re-running it is a
 * no-op (idempotent). Reference tables (subjects, skills, quest worlds /
 * chapters, policy versions, subprocessors) are immutable post-seed, so a
 * fresh postgres database must contain exactly as many rows as the memory
 * store after `ensureSeeded()`.
 *
 * Opt-in like the rest of the postgres parity suite: set
 * `AIVO_TEST_DATABASE_URL` (CI) or `AIVO_PARITY_POSTGRES=1` (local Docker).
 * Skipped otherwise so the file is green on Docker-less machines.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import {
  webSubjects,
  webSkills,
  webQuestWorlds,
  webQuestChapters,
  webPolicyVersions,
  webSubprocessors,
} from "@aivo/db";
import { ensureSeeded } from "@/lib/db/seed";
import { getStore } from "@/lib/db/store";
import { seedPostgres } from "../seed-postgres";
import { startPostgres, type PostgresHandle } from "./pg-testcontainer";

const POSTGRES_ENABLED =
  Boolean(process.env.AIVO_TEST_DATABASE_URL) || process.env.AIVO_PARITY_POSTGRES === "1";

if (!POSTGRES_ENABLED) {
  describe("seed parity — postgres", () => {
    it.skip("skipped — set AIVO_TEST_DATABASE_URL or AIVO_PARITY_POSTGRES=1", () => {});
  });
} else {
  describe("seed parity — postgres", () => {
    let handle: PostgresHandle | null = null;

    beforeAll(async () => {
      handle = await startPostgres();
      if (!handle) {
        throw new Error(
          "[seed-parity] postgres enabled but no Postgres available — start Docker " +
            "(testcontainers) or set AIVO_TEST_DATABASE_URL.",
        );
      }
    });

    afterAll(async () => {
      if (handle) await handle.teardown();
      handle = null;
    });

    async function count(table: PgTable): Promise<number> {
      const rows = await handle!.db
        .select({ n: sql<number>`count(*)::int` })
        .from(table);
      return rows[0]?.n ?? 0;
    }

    it("postgres reference-row counts equal the memory-seed counts", async () => {
      ensureSeeded();
      const mem = getStore();

      // First seed against the fresh container.
      await seedPostgres(handle!.db);

      const expectations: Array<[string, PgTable, number]> = [
        ["subjects", webSubjects, mem.subjects.size],
        ["skills", webSkills, mem.skills.size],
        ["questWorlds", webQuestWorlds, mem.questWorlds.size],
        ["questChapters", webQuestChapters, mem.questChapters.size],
        ["policyVersions", webPolicyVersions, mem.policyVersions.size],
        ["subprocessors", webSubprocessors, mem.subprocessors.size],
      ];

      for (const [name, table, expected] of expectations) {
        expect(expected, `memory seed produced 0 ${name}`).toBeGreaterThan(0);
        expect(await count(table), `postgres ${name} count != memory`).toBe(expected);
      }
    });

    it("re-seeding is idempotent (no new rows, counts unchanged)", async () => {
      ensureSeeded();
      const mem = getStore();

      const second = await seedPostgres(handle!.db);

      // Every reference insert conflicts on the natural key ⇒ 0 landed.
      expect(second.inserted.subjects).toBe(0);
      expect(second.inserted.skills).toBe(0);
      expect(second.inserted.questWorlds).toBe(0);
      expect(second.inserted.subprocessors).toBe(0);

      // And counts still match memory.
      expect(await count(webSubjects)).toBe(mem.subjects.size);
      expect(await count(webSkills)).toBe(mem.skills.size);
      expect(await count(webQuestWorlds)).toBe(mem.questWorlds.size);
      expect(await count(webSubprocessors)).toBe(mem.subprocessors.size);
    });
  });
}
