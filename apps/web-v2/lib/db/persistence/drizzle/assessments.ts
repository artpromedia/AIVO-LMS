/**
 * Drizzle-backed AssessmentStore — parent intake + baseline runs
 * (assessments, questions, attempts, telemetry). Mirrors the memory
 * store, including "latest answer wins" in recordBaselineAttempt
 * (delete the prior (questionId, learnerId) attempt, then insert) and
 * the order-sorted question list.
 */
import { and, eq, sql } from "drizzle-orm";
import {
  webParentAssessments,
  webBaselineAssessments,
  webBaselineQuestions,
  webBaselineAttempts,
  webBaselineTelemetry,
} from "@aivo/db";
import type {
  BaselineAssessment,
  BaselineAttempt,
  BaselineItemResponseLog,
  BaselineQuestion,
  ParentAssessment,
} from "@/lib/db/types";
import type { AssessmentStore } from "../types";
import { getDb, withTenantContext } from "./client";

export const drizzleAssessments: AssessmentStore = {
  async findParentAssessment(learnerId, tenantId) {
    // web_parent_assessments has an RLS `tenant_isolation` policy keyed on
    // the GUC `app.current_tenant` (0050_web_domain_rls.sql). The app
    // connects as the non-owner `aivo_app` role, for which the policy is
    // enforced and fail-closed: with no GUC set, the SELECT/INSERT affects
    // ZERO rows. withTenantContext opens a transaction and sets the GUC so
    // the write/read is permitted. (Passthrough in memory mode.)
    return withTenantContext(tenantId, async () => {
      const [row] = await getDb()
        .select()
        .from(webParentAssessments)
        .where(
          and(
            eq(webParentAssessments.learnerId, learnerId),
            eq(webParentAssessments.tenantId, tenantId),
          ),
        )
        .limit(1);
      return row ? (row.data as ParentAssessment) : null;
    });
  },

  async upsertParentAssessment(assessment) {
    return withTenantContext(assessment.tenantId, async () => {
      const db = getDb();
      await db
        .insert(webParentAssessments)
        .values({
          id: assessment.id,
          learnerId: assessment.learnerId,
          tenantId: assessment.tenantId,
          data: assessment,
        })
        .onConflictDoUpdate({
          target: webParentAssessments.id,
          set: { learnerId: assessment.learnerId, tenantId: assessment.tenantId, data: assessment },
        });
      return assessment;
    });
  },

  async getBaselineById(baselineId, tenantId) {
    const [row] = await getDb()
      .select()
      .from(webBaselineAssessments)
      .where(
        and(
          eq(webBaselineAssessments.id, baselineId),
          eq(webBaselineAssessments.tenantId, tenantId),
        ),
      )
      .limit(1);
    return row ? (row.data as BaselineAssessment) : null;
  },

  async getActiveBaselineForLearner(learnerId, tenantId) {
    const rows = await getDb()
      .select()
      .from(webBaselineAssessments)
      .where(
        and(
          eq(webBaselineAssessments.learnerId, learnerId),
          eq(webBaselineAssessments.tenantId, tenantId),
        ),
      );
    let latest: BaselineAssessment | null = null;
    for (const r of rows) {
      const b = r.data as BaselineAssessment;
      if (!latest || b.createdAt > latest.createdAt) latest = b;
    }
    return latest;
  },

  async upsertBaseline(baseline) {
    const db = getDb();
    await db
      .insert(webBaselineAssessments)
      .values({
        id: baseline.id,
        learnerId: baseline.learnerId,
        tenantId: baseline.tenantId,
        data: baseline,
      })
      .onConflictDoUpdate({
        target: webBaselineAssessments.id,
        set: { learnerId: baseline.learnerId, tenantId: baseline.tenantId, data: baseline },
      });
    return baseline;
  },

  async listBaselineQuestions(baselineId) {
    const rows = await getDb()
      .select()
      .from(webBaselineQuestions)
      .where(eq(webBaselineQuestions.baselineId, baselineId));
    return rows.map((r) => r.data as BaselineQuestion).sort((a, b) => a.order - b.order);
  },

  async appendBaselineQuestions(questions) {
    if (questions.length === 0) return;
    const db = getDb();
    await db
      .insert(webBaselineQuestions)
      .values(questions.map((q) => ({ id: q.id, baselineId: q.baselineId, data: q })))
      .onConflictDoUpdate({
        target: webBaselineQuestions.id,
        // memory `set(q.id, q)` overwrites; use the incoming row.
        set: { baselineId: sql`excluded.baseline_id`, data: sql`excluded.data` },
      });
  },

  async listBaselineAttempts(baselineId, tenantId) {
    const rows = await getDb()
      .select()
      .from(webBaselineAttempts)
      .where(
        and(
          eq(webBaselineAttempts.baselineId, baselineId),
          eq(webBaselineAttempts.tenantId, tenantId),
        ),
      );
    return rows.map((r) => r.data as BaselineAttempt);
  },

  async recordBaselineAttempt(attempt, replaceWhere) {
    const db = getDb();
    await db
      .delete(webBaselineAttempts)
      .where(
        and(
          eq(webBaselineAttempts.questionId, replaceWhere.questionId),
          eq(webBaselineAttempts.learnerId, replaceWhere.learnerId),
        ),
      );
    await db.insert(webBaselineAttempts).values({
      id: attempt.id,
      baselineId: attempt.baselineId,
      tenantId: attempt.tenantId,
      questionId: attempt.questionId,
      learnerId: attempt.learnerId,
      data: attempt,
    });
    return attempt;
  },

  async appendBaselineTelemetry(logs) {
    if (logs.length === 0) return;
    const db = getDb();
    await db
      .insert(webBaselineTelemetry)
      .values(logs.map((l) => ({ tenantId: l.tenantId, learnerId: l.learnerId ?? null, data: l })));
  },

  async listBaselineTelemetry({ tenantId, learnerId }) {
    const rows = await getDb()
      .select()
      .from(webBaselineTelemetry)
      .where(eq(webBaselineTelemetry.tenantId, tenantId));
    const all = rows.map((r) => r.data as BaselineItemResponseLog);
    return learnerId === undefined ? all : all.filter((l) => l.learnerId === learnerId);
  },
};
