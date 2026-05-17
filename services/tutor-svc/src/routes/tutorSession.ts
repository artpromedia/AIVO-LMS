/**
 * Generic tutor-session route — drives any catalog tutor through the
 * shared `@aivo/tutor-runtime` planner.
 *
 * `POST /api/tutors/:tutorKey/plan`
 *   Body:
 *     {
 *       learnerId: string,
 *       functioningLevel?: string,
 *       learnerAgeYears?: number,
 *       consentRecordId?: string,
 *       contentPack: ContentPack,
 *       masteryRecords?: MasteryRecord[],
 *       recentOutcomes?: AnswerOutcome[],
 *       recentlyCovered?: string[],
 *       interestProfile?: LearnerInterestProfile,
 *       maxActivities?: number
 *     }
 *   Returns:
 *     SessionPlan from `@aivo/tutor-runtime`.
 *
 * The pack is supplied in the body for now — the curriculum/CMS work
 * (Phase 4 of the rollout) will move pack loading server-side. Keeping
 * the interface push-based unblocks every downstream surface (web,
 * mobile, parent dashboards) without waiting on the CMS.
 *
 * The route is intentionally generic: every tutor in `TUTOR_REGISTRY`
 * is reachable through the same handler. Tutor-specific specialisation
 * (Speech Buddy's full audio loop, Pixel's `code_run` tool, Vigor's
 * DAPE branch, Compass's transition module) lives downstream and rides
 * the persona key the registry already exposes.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  planSession,
  checkPolicy,
  TutorPolicyError,
  type LearnerContext,
  type SessionPlan,
} from "@aivo/tutor-runtime";
import type { ContentPack } from "@aivo/content-pack";
import type { MasteryRecord, AnswerOutcome } from "@aivo/pedagogy";
import type { LearnerInterestProfile } from "@aivo/special-interest-engine";
import type { DapeProfileSummary } from "@aivo/scoring";
import { getTutorDefinition, listTutorDefinitions } from "../modes/registry.js";
import {
  buildLearnerContext,
  negotiateFunctioningLevel,
} from "../lib/learnerContext.js";
import { getStarterContentPack } from "../content-packs/index.js";
import { ConsentError, verifyTutorConsent } from "../lib/familyConsent.js";
import { getTutorsSchema, getTutorsByTutorKeySchema, tutorsByTutorKeyPlanSchema } from "./schemas.js";

interface PlanBody {
  learnerId?: string;
  tenantId?: string;
  functioningLevel?: string;
  learnerAgeYears?: number;
  consentRecordId?: string;
  consentAgeBand?: "6-9" | "10-12" | "13-15";
  contentPack?: ContentPack;
  masteryRecords?: MasteryRecord[];
  recentOutcomes?: AnswerOutcome[];
  recentlyCovered?: string[];
  interestProfile?: LearnerInterestProfile;
  maxActivities?: number;
  /** Pre-loaded DAPE summary (used by Vigor). The chat layer attaches
   *  this to ai-svc `brain_context` so the prompt builder renders the
   *  DAPE Track block defined in `prompt_builder._build_dape_block`. */
  dapeProfile?: DapeProfileSummary;
  /** BCP-47 base locale (e.g. "es", "fr") for the learner's selected UI
   *  language. The chat layer forwards this to ai-svc so persona system
   *  prompts include a `Respond in {language}` directive. Optional —
   *  defaults to English when omitted. */
  locale?: string;
}

/** Hint to the caller that a tutor delegates part of its session to a
 *  separate, specialised endpoint. Today only Echo delegates — the live
 *  voice loop runs through the existing Speech Buddy session API. */
interface TutorDelegate {
  kind: "speech-buddy";
  /** Reason surfaced to logs / UI. */
  reason: string;
  /** Endpoint the caller should drive after consuming the plan. */
  endpoint: string;
}

interface PlanResponse extends SessionPlan {
  /** Persona key from `tutor_personas.py` for the ai-svc chat handoff. */
  aiSvcPersonaKey?: string;
  /** The TutorDefinition id that produced this plan (for replay). */
  tutorDefinitionId: string;
  /** Echoed `dapeProfile` for downstream chat layers. Vigor only. */
  dapeProfile?: DapeProfileSummary;
  /** Delegation marker — present only when the tutor partially defers
   *  its session loop to a specialised endpoint. */
  delegate?: TutorDelegate;
  /** Source of the content pack that drove the plan. `request` means the
   *  caller supplied it; `starter` means tutor-svc fell back to the
   *  registered starter pack. */
  contentPackSource: "request" | "starter";
}

export function registerTutorSessionRoutes(app: FastifyInstance): void {
  // ── GET /api/tutors ────────────────────────────────────────────────
  // Lightweight catalog endpoint so the UI / admin can verify which
  // tutors the runtime knows about and what they support.
  app.get("/api/tutors", { schema: getTutorsSchema }, async () => {
    return {
      tutors: listTutorDefinitions().map(([key, def]) => ({
        key,
        id: def.id,
        persona: def.persona,
        subjects: def.subjects,
        gradeBands: def.gradeBands,
        functioningLevels: def.functioningLevels,
        capabilities: def.capabilities,
        skillGraphRefs: def.skillGraphRefs,
        defaultContentPackRefs: def.defaultContentPackRefs,
        policy: def.policy,
        aiSvcPersonaKey: def.authoringMeta?.aiSvcPersonaKey,
      })),
    };
  });

  // ── GET /api/tutors/:tutorKey ─────────────────────────────────────
  app.get<{ Params: { tutorKey: string } }>(
    "/api/tutors/:tutorKey",
    { schema: getTutorsByTutorKeySchema }, async (req: FastifyRequest<{ Params: { tutorKey: string } }>, reply: FastifyReply) => {
      const def = getTutorDefinition(req.params.tutorKey);
      if (!def) {
        return reply.code(404).send({ error: `unknown tutor "${req.params.tutorKey}"` });
      }
      return def;
    },
  );

  // ── POST /api/tutors/:tutorKey/plan ───────────────────────────────
  app.post<{ Params: { tutorKey: string }; Body: PlanBody }>(
    "/api/tutors/:tutorKey/plan",
    { schema: tutorsByTutorKeyPlanSchema }, async (
      req: FastifyRequest<{ Params: { tutorKey: string }; Body: PlanBody }>,
      reply: FastifyReply,
    ) => {
      const { tutorKey } = req.params;
      const def = getTutorDefinition(tutorKey);
      if (!def) {
        return reply.code(404).send({ error: `unknown tutor "${tutorKey}"` });
      }

      const body: PlanBody = req.body ?? {};
      if (!body.learnerId) {
        return reply.code(400).send({ error: "learnerId is required" });
      }

      // Phase 4: fall back to the tutor's starter content pack when
      // the caller hasn't shipped one. This keeps the route functional
      // end-to-end before the curriculum CMS is online.
      let contentPackSource: "request" | "starter" = "request";
      let contentPack = body.contentPack;
      if (!contentPack || !Array.isArray(contentPack.activities)) {
        const starter = getStarterContentPack(tutorKey);
        if (!starter) {
          return reply
            .code(400)
            .send({ error: "contentPack with activities[] is required" });
        }
        contentPack = starter;
        contentPackSource = "starter";
      }

      // Phase 5: generic family-consent gate. When the tutor's policy
      // demands consent and the caller hasn't already shipped a record
      // id, attempt to verify with family-svc (with a dev short-circuit
      // for tests). Tutor-specific consent flows (Speech Buddy live
      // voice) still own their own verifier — this gate covers the
      // text-and-image-first tutors (Harmony, Compass, Pixel, Vigor, …).
      let consentRecordId = body.consentRecordId;
      if (def.policy.requiresConsent && !consentRecordId && body.tenantId) {
        try {
          consentRecordId = await verifyTutorConsent({
            tenantId: body.tenantId,
            learnerId: body.learnerId,
            tutorKey,
            ageBand: body.consentAgeBand,
          });
        } catch (err) {
          if (err instanceof ConsentError) {
            return reply
              .code(err.status)
              .send({ error: err.message, code: "consent_check_failed" });
          }
          throw err;
        }
      }

      // Policy gates first — fail fast before we build context.
      try {
        checkPolicy(def, {
          consentRecordId,
          learnerAgeYears: body.learnerAgeYears,
        });
      } catch (err) {
        if (err instanceof TutorPolicyError) {
          const status = err.code === "consent_missing" ? 403 : 400;
          return reply.code(status).send({ error: err.message, code: err.code });
        }
        throw err;
      }

      // Negotiate a supported functioning level — this lets the runtime
      // serve a learner whose nominal level isn't on the tutor's list,
      // by stepping toward the most-supportive level the tutor offers.
      const baseCtx: LearnerContext = buildLearnerContext({
        learnerId: body.learnerId,
        functioningLevel: body.functioningLevel,
        masteryRecords: body.masteryRecords,
        recentOutcomes: body.recentOutcomes,
        recentlyCovered: body.recentlyCovered,
        interestProfile: body.interestProfile,
      });
      const negotiated = negotiateFunctioningLevel(baseCtx.functioningLevel, def);
      if (!negotiated) {
        return reply.code(400).send({
          error: `tutor ${def.id} declares no supported functioning levels`,
        });
      }
      const ctx: LearnerContext = { ...baseCtx, functioningLevel: negotiated };

      try {
        const plan = planSession(def, ctx, contentPack, {
          maxActivities: body.maxActivities,
        });
        const response: PlanResponse = {
          ...plan,
          tutorDefinitionId: def.id,
          aiSvcPersonaKey: def.authoringMeta?.aiSvcPersonaKey,
          contentPackSource,
        };

        // Echo delegates its live voice loop to Speech Buddy. The plan
        // still carries skill targets so the caller can prime the SB
        // session with `targetedSkills`, but the audio I/O happens on
        // the SB endpoint rather than this route.
        if (tutorKey === "echo") {
          response.delegate = {
            kind: "speech-buddy",
            reason: "Echo delegates the live voice loop to Speech Buddy.",
            endpoint: "/api/speech-buddy/sessions",
          };
        }

        // Vigor consumes a DAPE profile to switch to the adapted-PE
        // track. We accept the summary in the body and echo it on the
        // response so the chat layer attaches it to ai-svc
        // `brain_context.dape_profile`.
        if (tutorKey === "vigor" && body.dapeProfile) {
          response.dapeProfile = body.dapeProfile;
        }

        return response;
      } catch (err) {
        if (err instanceof TutorPolicyError) {
          return reply.code(400).send({ error: err.message, code: err.code });
        }
        const message = err instanceof Error ? err.message : String(err);
        req.log?.error?.({ err }, "tutor.plan_failed");
        return reply.code(500).send({ error: "plan failed", detail: message });
      }
    },
  );
}
