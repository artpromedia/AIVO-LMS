/**
 * Single mastery store (adaptive-learning E2E Sprint 7).
 *
 * learning-svc session completion previously wrote only gradebookEntries —
 * its evidence never reached the web mastery store
 * (web_skill_masteries / web_mastery_maps) that drives next-skill
 * selection, learning paths, trajectory snapshots, and the recommendation
 * loop. This writer lands the same evidence there, using the SAME canonical
 * EWMA from @aivo/scoring that the web pipeline applies.
 *
 * THE JOIN (verified, not guessed): `masteryUpdates` keys are heterogeneous —
 * the mobile stage sends the session's SUBJECT slug (e.g. "math"), while
 * path-launched sessions send skill identifiers. A key joins the web skill
 * space when it matches a web_skills row by id OR by its `slug` in the data
 * payload. Unmatched keys (e.g. bare subject slugs) are skipped with a
 * structured log and remain in the gradebook (teacher reporting) — they are
 * visible, never silently re-mapped onto skills the learner didn't practice.
 *
 * Scores arrive on either scale: values > 1 are percentages (mobile sends
 * 0–100) and are normalized to [0, 1] before the EWMA applies.
 */
import { and, eq, sql } from "drizzle-orm";
import { webSkills, webSkillMasteries, webMasteryMaps, webLearnerProfiles } from "@aivo/db";
import {
  masteryLevelFromScore,
  moveMasteryScore,
} from "@aivo/scoring";

interface LogLike {
  info: (obj: object, msg?: string) => void;
  warn: (obj: object, msg?: string) => void;
}

interface DbLike {
  select: (...args: never[]) => unknown;
  insert: (...args: never[]) => unknown;
  update: (...args: never[]) => unknown;
  delete: (...args: never[]) => unknown;
}

export interface WebMasteryMovement {
  skillId: string;
  before: number;
  after: number;
}

/** Normalize a reported score: values > 1 are percentages. */
export function normalizeMasteryScore(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  const value = raw > 1 ? raw / 100 : raw;
  return Math.max(0, Math.min(1, value));
}

/**
 * Cross-platform unification (Task #34): translate the canonical identity-svc
 * learner UUID that session completion carries into the web app's own `lrn_*`
 * profile id. The web mastery store (and the parent/teacher dashboards that
 * read it) key off the web id, so without this hop a learner enrolled from
 * mobile (or any session keyed by the identity UUID) would have their mastery
 * land under an id the web side never reads.
 *
 * Returns the linked web id when a profile links this UUID, otherwise the
 * input id unchanged (web-origin sessions already pass the `lrn_*` id, and the
 * fallback keeps legacy behavior intact when no link exists yet).
 */
export async function resolveWebLearnerId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  tenantId: string,
  learnerId: string,
): Promise<string> {
  const [row] = await db
    .select({ id: webLearnerProfiles.id })
    .from(webLearnerProfiles)
    .where(
      and(
        eq(webLearnerProfiles.tenantId, tenantId),
        eq(sql`${webLearnerProfiles.data}->>'identityLearnerId'`, learnerId),
      ),
    )
    .limit(1);
  return row?.id ?? learnerId;
}

export async function writeMasteryToWebStore(
  dbLike: DbLike,
  log: LogLike,
  input: {
    tenantId: string;
    learnerId: string;
    /** Raw masteryUpdates from session completion (key → score). */
    updates: Record<string, number>;
  },
): Promise<WebMasteryMovement[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = dbLike as any;
  const movements: WebMasteryMovement[] = [];
  const now = new Date().toISOString();
  // Cross-platform unification (Task #34): the inbound learnerId may be the
  // canonical identity-svc UUID; resolve it to the web `lrn_*` id the mastery
  // store + dashboards key off (falls back to the input id when unlinked).
  const learnerId = await resolveWebLearnerId(db, input.tenantId, input.learnerId);

  for (const [key, rawScore] of Object.entries(input.updates)) {
    // Join: web_skills by id, else by slug carried in the jsonb payload.
    let [skillRow] = await db
      .select({ id: webSkills.id, subjectId: webSkills.subjectId, data: webSkills.data })
      .from(webSkills)
      .where(eq(webSkills.id, key))
      .limit(1);
    if (!skillRow) {
      [skillRow] = await db
        .select({ id: webSkills.id, subjectId: webSkills.subjectId, data: webSkills.data })
        .from(webSkills)
        .where(eq(sql`${webSkills.data}->>'slug'`, key))
        .limit(1);
    }
    if (!skillRow) {
      log.info(
        {
          event: "web_mastery.key_unmatched",
          learnerId,
          key,
        },
        "masteryUpdates key does not join the web skill space; gradebook only",
      );
      continue;
    }

    const target = normalizeMasteryScore(rawScore);
    const [existingRow] = await db
      .select({ id: webSkillMasteries.id, data: webSkillMasteries.data })
      .from(webSkillMasteries)
      .where(
        and(
          eq(webSkillMasteries.learnerId, learnerId),
          eq(webSkillMasteries.tenantId, input.tenantId),
          eq(sql`${webSkillMasteries.data}->>'skillId'`, skillRow.id),
        ),
      )
      .limit(1);
    const existing = existingRow?.data as
      | { score: number; confidence: number; subjectId: string }
      | undefined;
    const before = existing?.score ?? 0;
    const after = moveMasteryScore(before, target);

    const nextRow = {
      learnerId,
      tenantId: input.tenantId,
      skillId: skillRow.id,
      subjectId: existing?.subjectId ?? skillRow.subjectId ?? "unknown",
      score: after,
      level: masteryLevelFromScore(after),
      confidence: existing ? Math.min(1, existing.confidence + 0.05) : 0.6,
      needsReview: target < 0.5,
      lastEvaluatedAt: now,
    };
    // Delete-then-insert with the web adapter's deterministic surrogate key —
    // identical semantics to web-v2's drizzle CurriculumStore, so both
    // writers heal legacy random-id rows the same way.
    const rowId = `sm:${input.tenantId}:${learnerId}:${skillRow.id}`;
    await db
      .delete(webSkillMasteries)
      .where(
        and(
          eq(webSkillMasteries.learnerId, learnerId),
          eq(webSkillMasteries.tenantId, input.tenantId),
          eq(sql`${webSkillMasteries.data}->>'skillId'`, skillRow.id),
        ),
      );
    await db.insert(webSkillMasteries).values({
      id: rowId,
      learnerId,
      tenantId: input.tenantId,
      data: nextRow,
    });
    movements.push({ skillId: skillRow.id, before, after });
  }

  if (movements.length > 0) {
    // Bump (or create) the mastery map so dashboards reflect freshness.
    const [mapRow] = await db
      .select({ id: webMasteryMaps.id, data: webMasteryMaps.data })
      .from(webMasteryMaps)
      .where(
        and(
          eq(webMasteryMaps.learnerId, learnerId),
          eq(webMasteryMaps.tenantId, input.tenantId),
        ),
      )
      .limit(1);
    if (mapRow) {
      await db
        .update(webMasteryMaps)
        .set({ data: { ...(mapRow.data as Record<string, unknown>), updatedAt: now } })
        .where(eq(webMasteryMaps.id, mapRow.id));
    } else {
      const mapId = `mmap:svc:${input.tenantId}:${learnerId}`;
      await db.insert(webMasteryMaps).values({
        id: mapId,
        learnerId,
        tenantId: input.tenantId,
        data: {
          id: mapId,
          learnerId,
          tenantId: input.tenantId,
          generatedAt: now,
          updatedAt: now,
        },
      });
    }
    log.info(
      {
        event: "web_mastery.updated",
        learnerId,
        skills: movements.map((m) => m.skillId),
      },
      "session completion landed in the web mastery store",
    );
  }
  return movements;
}
