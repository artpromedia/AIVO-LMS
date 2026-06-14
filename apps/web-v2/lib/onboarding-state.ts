import { getCareTeam } from "@/lib/db/team-invites";
import { getActiveBaselineForLearner, getBrainProfile, findParentAssessment } from "@/lib/db/repos";

export type LearnerOnboardingState =
  | "learner_created"
  | "parent_assessment_in_progress"
  | "parent_assessment_complete"
  | "contributors_pending"
  | "baseline_ready"
  | "baseline_complete"
  | "brain_clone_pending"
  | "brain_review_required"
  | "brain_approved"
  | "pin_ready"
  | "learner_app_open";

export type OnboardingEvent =
  | "learner_created"
  | "parent_assessment_started"
  | "parent_assessment_submitted"
  | "baseline_started"
  | "baseline_completed"
  | "brain_clone_completed"
  | "brain_approved"
  | "pin_created"
  | "learner_app_opened";

export type OnboardingRecord = {
  learnerId: string;
  tenantId: string;
  state: LearnerOnboardingState;
  updatedAt: string;
  awaitedContributorCount: number;
};

export type OnboardingTransition = {
  learnerId: string;
  tenantId: string;
  from: LearnerOnboardingState | null;
  to: LearnerOnboardingState;
  event: OnboardingEvent;
  actorId: string;
  at: string;
  metadata?: Record<string, unknown>;
};

const records = new Map<string, OnboardingRecord>();
const transitions: OnboardingTransition[] = [];
const key = (tenantId: string, learnerId: string) => `${tenantId}:${learnerId}`;

async function awaitedContributorCount(learnerId: string, tenantId: string): Promise<number> {
  const team = await getCareTeam(learnerId, tenantId).catch(() => null);
  if (!team) return 0;
  return [...team.teachers, ...team.caregivers, ...team.therapists].filter((m) => m.status === "PENDING").length;
}

export async function deriveOnboardingState(learnerId: string, tenantId: string): Promise<OnboardingRecord> {
  const [assessment, baseline, brain, awaited] = await Promise.all([
    findParentAssessment(learnerId, tenantId),
    getActiveBaselineForLearner(learnerId, tenantId),
    getBrainProfile(learnerId, tenantId),
    awaitedContributorCount(learnerId, tenantId),
  ]);
  let state: LearnerOnboardingState = "learner_created";
  if (assessment && !assessment.submittedAt && assessment.completedSections.length > 0) state = "parent_assessment_in_progress";
  if (assessment?.submittedAt) state = "baseline_ready";
  if (baseline?.status === "complete") state = "baseline_complete";
  if (baseline?.status === "complete" && !brain) state = "brain_clone_pending";
  if (brain?.cloneStage === "cloned") state = "brain_review_required";
  if (brain?.cloneStage === "approved") state = "brain_approved";
  const record = { learnerId, tenantId, state, updatedAt: new Date().toISOString(), awaitedContributorCount: awaited };
  records.set(key(tenantId, learnerId), record);
  return record;
}

const NEXT: Partial<Record<OnboardingEvent, LearnerOnboardingState>> = {
  learner_created: "learner_created",
  parent_assessment_started: "parent_assessment_in_progress",
  baseline_started: "baseline_ready",
  baseline_completed: "baseline_complete",
  brain_clone_completed: "brain_review_required",
  brain_approved: "brain_approved",
  pin_created: "pin_ready",
  learner_app_opened: "learner_app_open",
};

export async function advanceOnboarding(
  learnerId: string,
  tenantId: string,
  event: OnboardingEvent,
  actorId: string,
  metadata: Record<string, unknown> = {},
): Promise<OnboardingRecord> {
  const current = records.get(key(tenantId, learnerId)) ?? (await deriveOnboardingState(learnerId, tenantId));
  const awaited = await awaitedContributorCount(learnerId, tenantId);
  let to = NEXT[event];
  if (event === "parent_assessment_submitted") {
    // Product policy for this implementation: do not block the child's baseline
    // on awaited contributors. Late teacher/therapist/caregiver input continues
    // to enter the brain-change/recommendation flow after baseline.
    to = "baseline_ready";
  }
  if (!to) throw new Error(`Unsupported onboarding event: ${event}`);
  const record: OnboardingRecord = {
    learnerId,
    tenantId,
    state: to,
    updatedAt: new Date().toISOString(),
    awaitedContributorCount: awaited,
  };
  records.set(key(tenantId, learnerId), record);
  transitions.push({ learnerId, tenantId, from: current.state, to, event, actorId, at: record.updatedAt, metadata: { ...metadata, awaitedContributorCount: awaited } });
  return record;
}

export async function requireOnboardingState(
  learnerId: string,
  tenantId: string,
  allowed: LearnerOnboardingState[],
): Promise<{ ok: true; record: OnboardingRecord } | { ok: false; record: OnboardingRecord }> {
  const record = await deriveOnboardingState(learnerId, tenantId);
  return allowed.includes(record.state) ? { ok: true, record } : { ok: false, record };
}

export function listOnboardingTransitions(learnerId: string, tenantId: string): OnboardingTransition[] {
  return transitions.filter((t) => t.tenantId === tenantId && t.learnerId === learnerId);
}

export function resetOnboardingStateForTests() {
  records.clear();
  transitions.length = 0;
}
