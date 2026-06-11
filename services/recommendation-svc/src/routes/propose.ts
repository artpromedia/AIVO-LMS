/**
 * Wave E (S11) — tutor-agent recommendation proposals.
 *
 * POST /api/recommendations/propose — a tutor agent (via tutor-svc) files
 * ONE candidate recommendation for parent/teacher approval. This is the
 * agent's only path into the profile: nothing here mutates learner state —
 * a human decision through the existing accept/amend/decline routes does.
 *
 * Guard rails (server-side, not trust-the-caller):
 *   - TYPE POLICY  — agents may propose only instructional types
 *     (tutor_strategy_change, preferred_surface_change,
 *     self_regulation_support_add). Functioning level, IEP-adjacent, and
 *     rebaseline types are NOT proposable by a tutor.
 *   - DEDUPE       — one PENDING per (learner, type); a duplicate returns
 *     409 with the existing id.
 *   - COOLDOWN     — at most one proposal per (learner, type) per 14 days
 *     regardless of how the last one was decided; early retries get 429
 *     with the remaining days.
 */
import type { FastifyInstance } from "fastify";
import type {
  ProfileRecommendation,
  ProfileRecommendationType,
} from "../services/types.js";
import type { RecommendationStore } from "../services/recommendation-store.js";
import { notifyGuardianOfPending } from "../services/recommendation-notifier.js";
import { defaultStore } from "./recommendations.js";

/** Types a tutor agent may propose. Widening this list is a policy change
 *  reviewed with the safety team, not a tutor-authoring change. */
export const TUTOR_PROPOSABLE_TYPES: readonly ProfileRecommendationType[] = [
  "tutor_strategy_change",
  "preferred_surface_change",
  "self_regulation_support_add",
];

export const PROPOSAL_COOLDOWN_DAYS = 14;
const COOLDOWN_MS = PROPOSAL_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

export interface ProposeBody {
  tenantId?: string;
  learnerId: string;
  tutorKey: string;
  sessionId?: string;
  type: ProfileRecommendationType;
  title: string;
  parentSummary: string;
  currentValue?: unknown;
  proposedValue: unknown;
  confidence?: number;
  evidenceSummary?: string;
}

export interface ProposeRouteDeps {
  store?: RecommendationStore;
  db?: { select: (...args: never[]) => unknown };
  now?: () => number;
}

export function registerProposeRoute(app: FastifyInstance, deps: ProposeRouteDeps = {}): void {
  const store = deps.store ?? defaultStore;
  const now = deps.now ?? Date.now;

  app.post<{ Body: ProposeBody }>("/api/recommendations/propose", async (request, reply) => {
    const body = request.body ?? ({} as ProposeBody);
    const tenantId = (request as { auth?: { tenantId?: string } }).auth?.tenantId ?? body.tenantId;
    if (!body.learnerId || !body.tutorKey) {
      return reply.code(400).send({ error: "learnerId and tutorKey are required" });
    }
    if (!tenantId) {
      return reply.code(400).send({ error: "tenantId is required (auth context or body)" });
    }
    if (!TUTOR_PROPOSABLE_TYPES.includes(body.type)) {
      return reply.code(403).send({
        error: `type "${body.type}" is not tutor-proposable`,
        allowedTypes: TUTOR_PROPOSABLE_TYPES,
      });
    }
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 160) : "";
    const parentSummary =
      typeof body.parentSummary === "string" ? body.parentSummary.trim().slice(0, 600) : "";
    if (title.length < 8 || parentSummary.length < 20) {
      return reply.code(422).send({
        error: "title (≥8 chars) and parentSummary (≥20 chars) are required — parents decide from this text",
      });
    }
    if (body.proposedValue === undefined || body.proposedValue === null) {
      return reply.code(422).send({ error: "proposedValue is required" });
    }

    const existing = await store.listByLearner(body.learnerId);
    const sameType = existing.filter((r) => r.type === body.type);
    const pending = sameType.find((r) => r.status === "PENDING");
    if (pending) {
      return reply.code(409).send({
        error: "duplicate_pending",
        existingId: pending.id,
        message: `a PENDING ${body.type} recommendation already exists for this learner`,
      });
    }
    const newest = sameType
      .map((r) => Date.parse(r.createdAt))
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => b - a)[0];
    if (newest !== undefined && now() - newest < COOLDOWN_MS) {
      const remainingDays = Math.ceil((COOLDOWN_MS - (now() - newest)) / (24 * 60 * 60 * 1000));
      return reply.code(429).send({
        error: "cooldown",
        retryAfterDays: remainingDays,
        message: `a ${body.type} recommendation was already proposed in the last ${PROPOSAL_COOLDOWN_DAYS} days`,
      });
    }

    const confidence =
      typeof body.confidence === "number" && body.confidence >= 0 && body.confidence <= 1
        ? body.confidence
        : 0.5;
    const createdAt = new Date(now()).toISOString();
    const recommendation: ProfileRecommendation = {
      id: `rec_${Math.random().toString(36).slice(2, 10)}${now().toString(36)}`,
      learnerId: body.learnerId,
      type: body.type,
      title,
      parentSummary,
      currentValue: body.currentValue ?? null,
      proposedValue: body.proposedValue,
      confidence,
      evidence: [
        {
          source: "tutor_session",
          summary:
            typeof body.evidenceSummary === "string" && body.evidenceSummary.trim()
              ? body.evidenceSummary.trim().slice(0, 400)
              : `Proposed by the ${body.tutorKey} tutor during a live session.`,
          occurredAt: createdAt,
          metadata: body.sessionId ? { sessionId: body.sessionId, tutorKey: body.tutorKey } : { tutorKey: body.tutorKey },
        },
      ],
      safety: {
        requiresParentApproval: true,
        affectsIEP: false,
        affectsInstructionalAccess: false,
        reversible: true,
      },
      status: "PENDING",
      createdAt,
      updatedAt: createdAt,
    };
    await store.create(recommendation);

    if (deps.db) {
      void notifyGuardianOfPending(deps.db, request.log, {
        learnerId: body.learnerId,
        recommendations: [recommendation],
      });
    }

    return reply.code(201).send({ recommendation, tenantId });
  });
}
