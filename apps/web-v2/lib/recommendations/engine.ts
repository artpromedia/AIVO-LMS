/**
 * In-memory recommendation engine (dev / demo / test).
 *
 * `services/recommendation-svc` owns recommendations in production; the BFF
 * proxies it. Locally that upstream isn't running, so the parent Notifications
 * inbox would render its "unavailable" state. This engine is the dual-path
 * fallback `lib/bff/recommendation-svc.ts` uses when no internal service token
 * is configured, so the inbox works end to end on a dev box.
 *
 * Recommendations are GENERATED from the learner's real mastery data (no
 * fabricated suggestions): a subject the learner is consistently mastering
 * yields a "ready for more challenge" proposal; one they're struggling with
 * yields an "add support" proposal. Evidence cites the real skill counts.
 * Parent decisions (accept / amend / add-context / decline) persist in a
 * process-scoped store and feed back into the list (decided items don't
 * re-surface); `undo` reverts to pending.
 */
import { getLearner, getMasteryMap, listSubjects } from "@/lib/db/repos";
import type { RecommendationSummary } from "@/lib/bff/recommendation-svc";

export type EngineAction = "accept" | "amend" | "decline" | "add_context" | "undo";

type DecisionStatus = "APPLIED" | "DECLINED" | "CONTEXT_ADDED";

interface Decision {
  status: DecisionStatus;
  reason?: string;
  context?: string;
  amendedValue?: unknown;
  decidedAt: string;
}

// Process-scoped decision store (dev/demo). Keyed by `${tenantId}:${recId}`.
const decisions = new Map<string, Decision>();
const storeKey = (tenantId: string, recId: string) => `${tenantId}:${recId}`;

const ADVANCE_THRESHOLD = 0.78;
const SUPPORT_THRESHOLD = 0.45;
const MIN_SKILLS = 3;
const MAX_RECS = 4;

function buildRecommendation(args: {
  learnerId: string;
  subjectId: string;
  subject: string;
  name: string;
  kind: "advance" | "support";
  avg: number;
  count: number;
  createdAt: string;
}): RecommendationSummary {
  const { learnerId, subjectId, subject, name, kind, avg, count, createdAt } = args;
  const advance = kind === "advance";
  const pct = Math.round(avg * 100);
  return {
    id: `rec_${learnerId}_${subjectId}_${kind}`,
    learnerId,
    type: advance ? "pace_advance" : "support_add",
    title: advance ? `Ready for more challenge in ${subject}` : `Extra support in ${subject}`,
    parentSummary: advance
      ? `${name} is consistently mastering ${subject}. AIVO can raise the challenge so lessons stay engaging.`
      : `${name} is finding ${subject} tricky right now. AIVO can add scaffolding and gentler pacing.`,
    currentValue: advance ? "On-track pacing" : "Standard pacing",
    proposedValue: advance
      ? { subjectKey: subject, from: "on-track", to: "stretch" }
      : { reason: "Extra scaffolding and more check-ins" },
    confidence: advance ? avg : 1 - avg,
    evidence: [
      {
        source: "mastery",
        summary: `${count} skills evaluated · average mastery ${pct}%`,
        metric: "mastery",
        contributorRole: undefined,
      },
    ],
    safety: {
      requiresParentApproval: true,
      affectsIEP: false,
      affectsInstructionalAccess: advance,
      reversible: true,
    },
    status: "PENDING",
    createdAt,
    updatedAt: createdAt,
  };
}

/**
 * Pure-ish generation from real mastery data. Exported for unit testing with
 * injected mastery rows.
 */
export function buildCandidatesFromMastery(
  learnerId: string,
  name: string,
  skillMasteries: ReadonlyArray<{ subjectId: string; score: number; lastEvaluatedAt: string | null }>,
  subjectName: (id: string) => string,
): RecommendationSummary[] {
  const bySubject = new Map<string, { scores: number[]; latest: string | null }>();
  for (const m of skillMasteries) {
    const g = bySubject.get(m.subjectId) ?? { scores: [], latest: null };
    g.scores.push(m.score);
    if (m.lastEvaluatedAt && (!g.latest || m.lastEvaluatedAt > g.latest)) g.latest = m.lastEvaluatedAt;
    bySubject.set(m.subjectId, g);
  }
  const fallbackCreatedAt = new Date(0).toISOString();
  const out: RecommendationSummary[] = [];
  for (const [subjectId, g] of bySubject) {
    if (g.scores.length < MIN_SKILLS) continue;
    const avg = g.scores.reduce((a, b) => a + b, 0) / g.scores.length;
    const createdAt = g.latest ?? fallbackCreatedAt;
    if (avg >= ADVANCE_THRESHOLD) {
      out.push(
        buildRecommendation({
          learnerId,
          subjectId,
          subject: subjectName(subjectId),
          name,
          kind: "advance",
          avg,
          count: g.scores.length,
          createdAt,
        }),
      );
    } else if (avg <= SUPPORT_THRESHOLD) {
      out.push(
        buildRecommendation({
          learnerId,
          subjectId,
          subject: subjectName(subjectId),
          name,
          kind: "support",
          avg,
          count: g.scores.length,
          createdAt,
        }),
      );
    }
  }
  // Strongest signals first (highest confidence), then a stable id tiebreaker.
  out.sort((a, b) => (b.confidence !== a.confidence ? b.confidence - a.confidence : a.id < b.id ? -1 : 1));
  return out.slice(0, MAX_RECS);
}

function applyDecision(rec: RecommendationSummary, d: Decision | undefined): RecommendationSummary {
  if (!d) return rec;
  return {
    ...rec,
    status: d.status,
    declineReason: d.reason,
    amendedValue: d.amendedValue,
    appliedAt: d.status === "APPLIED" ? d.decidedAt : undefined,
    updatedAt: d.decidedAt,
  };
}

async function candidates(learnerId: string, tenantId: string): Promise<RecommendationSummary[]> {
  const [mastery, learner, subjects] = await Promise.all([
    getMasteryMap(learnerId, tenantId),
    getLearner(learnerId, tenantId),
    listSubjects(),
  ]);
  const name = learner?.firstName || learner?.displayName?.split(" ")[0] || "your learner";
  const nameOf = new Map(subjects.map((s) => [s.id, s.name]));
  return buildCandidatesFromMastery(
    learnerId,
    name,
    mastery.skillMasteries,
    (id) => nameOf.get(id) ?? id,
  );
}

/** All recommendations for a learner (decisions overlaid). */
export async function engineList(
  learnerId: string,
  tenantId: string,
): Promise<RecommendationSummary[]> {
  const cands = await candidates(learnerId, tenantId);
  return cands.map((c) => applyDecision(c, decisions.get(storeKey(tenantId, c.id))));
}

/** Record (or undo) a parent decision; returns the updated rec, or null if unknown. */
export async function engineRespond(
  learnerId: string,
  tenantId: string,
  recId: string,
  action: EngineAction,
  opts: { context?: string; reason?: string; amendedValue?: unknown } = {},
): Promise<RecommendationSummary | null> {
  const rec = (await candidates(learnerId, tenantId)).find((c) => c.id === recId);
  if (!rec) return null;

  const k = storeKey(tenantId, recId);
  if (action === "undo") {
    decisions.delete(k);
    return applyDecision(rec, undefined);
  }

  const decidedAt = new Date().toISOString();
  let decision: Decision;
  switch (action) {
    case "decline":
      decision = { status: "DECLINED", reason: opts.reason, decidedAt };
      break;
    case "add_context":
      decision = { status: "CONTEXT_ADDED", context: opts.context, decidedAt };
      break;
    case "amend":
      decision = { status: "APPLIED", amendedValue: opts.amendedValue, decidedAt };
      break;
    case "accept":
    default:
      decision = { status: "APPLIED", decidedAt };
      break;
  }
  decisions.set(k, decision);
  return applyDecision(rec, decision);
}

/** Test-only: clear the decision store between cases. */
export function __resetRecommendationEngine(): void {
  decisions.clear();
}
