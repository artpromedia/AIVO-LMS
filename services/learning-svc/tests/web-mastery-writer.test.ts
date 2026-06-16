/**
 * Single-mastery-store writer (Sprint 7): the documented join (web skill id
 * OR slug; unmatched keys skipped visibly), score normalization (0–100 →
 * 0–1), the shared EWMA, and mastery-map freshness.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { webSkills, webSkillMasteries, webMasteryMaps, webLearnerProfiles } from "@aivo/db";
import {
  normalizeMasteryScore,
  writeMasteryToWebStore,
} from "../src/services/web-mastery-writer.js";

const log = { info: () => {}, warn: () => {} };

interface FakeState {
  skills: Array<{ id: string; subjectId: string | null; data: Record<string, unknown> }>;
  masteries: Array<{ id: string; data: Record<string, unknown> }>;
  maps: Array<{ id: string; data: Record<string, unknown> }>;
  /** Cross-platform unification (Task #34): web profiles linking identity UUIDs. */
  profiles?: Array<{ id: string }>;
}

/**
 * Recording fake: select dispatches per table; the two webSkills lookups
 * (by id, then by slug) are distinguished by call order per key, so the
 * fake matches on BOTH and returns the row whenever the key matches either.
 */
function fakeDb(state: FakeState) {
  const inserted: Array<{ table: unknown; values: Record<string, unknown> }> = [];
  const deleted: unknown[] = [];
  const updated: Array<Record<string, unknown>> = [];
  let pendingSkillKey: string | null = null;
  let skillLookupPhase: "id" | "slug" = "id";

  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: (..._args: unknown[]) => {
          const chain = {
            limit: async () => {
              if (table === webSkills) {
                const key = pendingSkillKey!;
                const match = state.skills.find((s) =>
                  skillLookupPhase === "id" ? s.id === key : s.data.slug === key,
                );
                skillLookupPhase = skillLookupPhase === "id" ? "slug" : "id";
                return match ? [match] : [];
              }
              if (table === webSkillMasteries) {
                return state.masteries;
              }
              if (table === webMasteryMaps) {
                return state.maps;
              }
              if (table === webLearnerProfiles) {
                return state.profiles ?? [];
              }
              return [];
            },
          };
          return chain;
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: async (values: Record<string, unknown>) => {
        inserted.push({ table, values });
      },
    }),
    update: (_table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          updated.push(values);
        },
      }),
    }),
    delete: (table: unknown) => ({
      where: async () => {
        deleted.push(table);
      },
    }),
  };
  return {
    db,
    inserted,
    deleted,
    updated,
    setKey: (k: string) => {
      pendingSkillKey = k;
      skillLookupPhase = "id";
    },
  };
}

test("normalizeMasteryScore handles both scales and clamps", () => {
  assert.equal(normalizeMasteryScore(0.7), 0.7);
  assert.equal(normalizeMasteryScore(85), 0.85);
  assert.equal(normalizeMasteryScore(150), 1);
  assert.equal(normalizeMasteryScore(-3), 0);
  assert.equal(normalizeMasteryScore(Number.NaN), 0);
});

test("a key matching a web skill id moves mastery with the shared EWMA", async () => {
  const fake = fakeDb({
    skills: [{ id: "skl-1", subjectId: "sub-1", data: { slug: "count-to-20" } }],
    masteries: [],
    maps: [],
  });
  fake.setKey("skl-1");
  const movements = await writeMasteryToWebStore(fake.db as never, log, {
    tenantId: "t-1",
    learnerId: "lrn-1",
    updates: { "skl-1": 100 },
  });
  assert.equal(movements.length, 1);
  // No prior row: before 0 → EWMA 25% toward 1.0 = 0.25.
  assert.equal(movements[0]!.before, 0);
  assert.equal(movements[0]!.after, 0.25);
  const masteryInsert = fake.inserted.find((i) => i.table === webSkillMasteries)!;
  assert.equal(masteryInsert.values.id, "sm:t-1:lrn-1:skl-1");
  const row = masteryInsert.values.data as Record<string, unknown>;
  assert.equal(row.score, 0.25);
  assert.equal(row.level, "emerging");
  assert.equal(row.subjectId, "sub-1");
  // Mastery map created (none existed).
  assert.ok(fake.inserted.some((i) => i.table === webMasteryMaps));
});

test("a key matching a slug joins; an unmatched key is skipped", async () => {
  const fake = fakeDb({
    skills: [{ id: "skl-2", subjectId: "sub-1", data: { slug: "add-within-10" } }],
    masteries: [],
    maps: [{ id: "mmap-1", data: { updatedAt: "old" } }],
  });
  fake.setKey("add-within-10");
  const m1 = await writeMasteryToWebStore(fake.db as never, log, {
    tenantId: "t-1",
    learnerId: "lrn-1",
    updates: { "add-within-10": 0.8 },
  });
  assert.equal(m1.length, 1);
  assert.equal(m1[0]!.skillId, "skl-2");
  // Existing map bumped, not re-inserted.
  assert.equal(fake.updated.length, 1);

  const fake2 = fakeDb({ skills: [], masteries: [], maps: [] });
  fake2.setKey("math"); // bare subject slug — no skill, skipped visibly
  const m2 = await writeMasteryToWebStore(fake2.db as never, log, {
    tenantId: "t-1",
    learnerId: "lrn-1",
    updates: { math: 90 },
  });
  assert.equal(m2.length, 0);
  assert.equal(fake2.inserted.length, 0);
});

test("an identity UUID is translated to the linked web learner id (Task #34)", async () => {
  const fake = fakeDb({
    skills: [{ id: "skl-1", subjectId: "sub-1", data: { slug: "s" } }],
    masteries: [],
    maps: [],
    profiles: [{ id: "lrn-web-1" }], // links the identity UUID below
  });
  fake.setKey("skl-1");
  const movements = await writeMasteryToWebStore(fake.db as never, log, {
    tenantId: "t-1",
    learnerId: "11111111-2222-3333-4444-555555555555", // identity-svc UUID
    updates: { "skl-1": 100 },
  });
  assert.equal(movements.length, 1);
  // Mastery must land under the WEB id, not the identity UUID.
  const masteryInsert = fake.inserted.find((i) => i.table === webSkillMasteries)!;
  assert.equal(masteryInsert.values.id, "sm:t-1:lrn-web-1:skl-1");
  assert.equal(masteryInsert.values.learnerId, "lrn-web-1");
  const mapInsert = fake.inserted.find((i) => i.table === webMasteryMaps)!;
  assert.equal(mapInsert.values.learnerId, "lrn-web-1");
});

test("an unlinked learner id is used as-is (legacy fallback)", async () => {
  const fake = fakeDb({
    skills: [{ id: "skl-1", subjectId: "sub-1", data: { slug: "s" } }],
    masteries: [],
    maps: [],
    profiles: [], // no link
  });
  fake.setKey("skl-1");
  await writeMasteryToWebStore(fake.db as never, log, {
    tenantId: "t-1",
    learnerId: "lrn-direct",
    updates: { "skl-1": 100 },
  });
  const masteryInsert = fake.inserted.find((i) => i.table === webSkillMasteries)!;
  assert.equal(masteryInsert.values.id, "sm:t-1:lrn-direct:skl-1");
  assert.equal(masteryInsert.values.learnerId, "lrn-direct");
});

test("an existing row moves from its prior score and keeps its subject", async () => {
  const fake = fakeDb({
    skills: [{ id: "skl-1", subjectId: "sub-1", data: { slug: "s" } }],
    masteries: [
      { id: "sm:t-1:lrn-1:skl-1", data: { score: 0.4, confidence: 0.6, subjectId: "sub-9" } },
    ],
    maps: [{ id: "mmap-1", data: {} }],
  });
  fake.setKey("skl-1");
  const movements = await writeMasteryToWebStore(fake.db as never, log, {
    tenantId: "t-1",
    learnerId: "lrn-1",
    updates: { "skl-1": 1 },
  });
  assert.equal(movements[0]!.before, 0.4);
  assert.equal(movements[0]!.after, 0.55); // 0.4 + (1 - 0.4) * 0.25
  const row = fake.inserted.find((i) => i.table === webSkillMasteries)!.values
    .data as Record<string, unknown>;
  assert.equal(row.subjectId, "sub-9");
  assert.equal(row.confidence, 0.65);
});
