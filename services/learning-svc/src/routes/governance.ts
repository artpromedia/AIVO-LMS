import type { FastifyInstance } from "fastify";
import {
  registerGovernanceSubscriber,
  type GovernanceSubjectRequest,
  type EraseResult,
  type ExportResult,
} from "@aivo/enterprise-core";
import {
  lessonRuns,
  lessonInteractions,
  lessonParentSummaries,
  generatedLessonPlans,
  lessonSessions,
  learningPaths,
  gradebookEntries,
  tutorSessions,
  tutorDecisionTraces,
  tutorSessionEvidence,
  tutorMemories,
} from "@aivo/db";
import { eq } from "drizzle-orm";

// Note: lessonRuns / lessonInteractions / lessonParentSummaries use text
// primary keys and text learnerId (not UUID FK). The subjectId passed in
// must match whatever id shape was used when the learner's runs were
// created.
export function registerGovernanceRoutes(app: FastifyInstance, db: any): void {
  registerGovernanceSubscriber(app, {
    service: "learning-svc",

    async erase(req: GovernanceSubjectRequest): Promise<EraseResult> {
      if (!db) return { counts: {} };
      const uid = req.subjectId;

      // Fetch lesson run IDs first so we can cascade-delete child tables.
      const runRows = await db
        .select({ id: lessonRuns.id })
        .from(lessonRuns)
        .where(eq(lessonRuns.learnerId, uid));
      const runIds = runRows.map((r: { id: string }) => r.id);

      // Wave E (S9-S12): agent child tables reference tutor_sessions by FK —
      // they must go first or the tutor_sessions delete violates constraints.
      const [traces, evidence, memories] = await Promise.all([
        db
          .delete(tutorDecisionTraces)
          .where(eq(tutorDecisionTraces.learnerId, uid))
          .returning({ id: tutorDecisionTraces.id }),
        db
          .delete(tutorSessionEvidence)
          .where(eq(tutorSessionEvidence.learnerId, uid))
          .returning({ id: tutorSessionEvidence.id }),
        db
          .delete(tutorMemories)
          .where(eq(tutorMemories.learnerId, uid))
          .returning({ id: tutorMemories.id }),
      ]);

      const [interactions, summaries, plans, runs, sessions, paths, gradebook, tutorSess] =
        await Promise.all([
          runIds.length > 0
            ? db
                .delete(lessonInteractions)
                .where(eq(lessonInteractions.learnerId, uid))
                .returning({ id: lessonInteractions.id })
            : Promise.resolve([]),
          runIds.length > 0
            ? db
                .delete(lessonParentSummaries)
                .where(eq(lessonParentSummaries.learnerId, uid))
                .returning({ id: lessonParentSummaries.id })
            : Promise.resolve([]),
          runIds.length > 0
            ? Promise.all(
                runIds.map((rid: string) =>
                  db
                    .delete(generatedLessonPlans)
                    .where(eq(generatedLessonPlans.lessonRunId, rid))
                    .returning({ id: generatedLessonPlans.id }),
                ),
              ).then((arrs: unknown[][]) => arrs.flat())
            : Promise.resolve([]),
          db
            .delete(lessonRuns)
            .where(eq(lessonRuns.learnerId, uid))
            .returning({ id: lessonRuns.id }),
          db
            .delete(lessonSessions)
            .where(eq(lessonSessions.learnerId, uid))
            .returning({ id: lessonSessions.id }),
          db
            .delete(learningPaths)
            .where(eq(learningPaths.learnerId, uid))
            .returning({ id: learningPaths.id }),
          db
            .delete(gradebookEntries)
            .where(eq(gradebookEntries.learnerId, uid))
            .returning({ id: gradebookEntries.id }),
          db
            .delete(tutorSessions)
            .where(eq(tutorSessions.learnerId, uid))
            .returning({ id: tutorSessions.id }),
        ]);

      return {
        counts: {
          lesson_runs: runs.length,
          lesson_interactions: interactions.length,
          lesson_parent_summaries: summaries.length,
          generated_lesson_plans: plans.length,
          lesson_sessions: sessions.length,
          learning_paths: paths.length,
          gradebook_entries: gradebook.length,
          tutor_sessions: tutorSess.length,
          tutor_decision_traces: traces.length,
          tutor_session_evidence: evidence.length,
          tutor_memories: memories.length,
        },
      };
    },

    async export(req: GovernanceSubjectRequest): Promise<ExportResult> {
      if (!db) return { counts: {}, bundle: {} };
      const uid = req.subjectId;

      const [runs, sessions, paths, gradebook, tutorSess, evidence, memories] =
        await Promise.all([
          db.select().from(lessonRuns).where(eq(lessonRuns.learnerId, uid)),
          db.select().from(lessonSessions).where(eq(lessonSessions.learnerId, uid)),
          db.select().from(learningPaths).where(eq(learningPaths.learnerId, uid)),
          db.select().from(gradebookEntries).where(eq(gradebookEntries.learnerId, uid)),
          db.select().from(tutorSessions).where(eq(tutorSessions.learnerId, uid)),
          db.select().from(tutorSessionEvidence).where(eq(tutorSessionEvidence.learnerId, uid)),
          db.select().from(tutorMemories).where(eq(tutorMemories.learnerId, uid)),
        ]);

      return {
        counts: {
          lesson_runs: runs.length,
          lesson_sessions: sessions.length,
          learning_paths: paths.length,
          gradebook_entries: gradebook.length,
          tutor_sessions: tutorSess.length,
          tutor_session_evidence: evidence.length,
          tutor_memories: memories.length,
        },
        bundle: {
          lesson_runs: runs,
          lesson_sessions: sessions,
          learning_paths: paths,
          gradebook_entries: gradebook,
          tutor_sessions: tutorSess,
          tutor_session_evidence: evidence,
          tutor_memories: memories,
        },
      };
    },
  });
}
