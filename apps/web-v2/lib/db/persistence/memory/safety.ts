/**
 * In-memory SafetyStore — wraps moderationEvents / humanReviewCases /
 * safetyPolicyVersions / blockedGenerations / tutorResponseAudits /
 * homeworkInputAudits Maps. Test-only; the repo layer owns filtering/sorting +
 * the auto-review-case orchestration. Moderation events + audits are append-only.
 */
import { getStore } from "@/lib/db/store";
import type {
  BlockedGeneration,
  HomeworkInputAudit,
  HumanReviewCase,
  ModerationEvent,
  SafetyPolicyVersion,
  TutorResponseAudit,
} from "@/lib/db/types";
import type { SafetyStore } from "../types";

export const memorySafety: SafetyStore = {
  async listSafetyPolicyVersions(): Promise<SafetyPolicyVersion[]> {
    return Array.from(getStore().safetyPolicyVersions.values());
  },
  async appendModerationEvent(event) {
    getStore().moderationEvents.set(event.id, event);
    return event;
  },
  async getModerationEvent(id) {
    return getStore().moderationEvents.get(id) ?? null;
  },
  async listModerationEvents(): Promise<ModerationEvent[]> {
    return Array.from(getStore().moderationEvents.values());
  },
  async upsertHumanReviewCase(c) {
    getStore().humanReviewCases.set(c.id, c);
    return c;
  },
  async getHumanReviewCase(id) {
    return getStore().humanReviewCases.get(id) ?? null;
  },
  async listHumanReviewCases(): Promise<HumanReviewCase[]> {
    return Array.from(getStore().humanReviewCases.values());
  },
  async appendBlockedGeneration(b) {
    getStore().blockedGenerations.set(b.id, b);
    return b;
  },
  async listBlockedGenerations(): Promise<BlockedGeneration[]> {
    return Array.from(getStore().blockedGenerations.values());
  },
  async appendTutorResponseAudit(a) {
    getStore().tutorResponseAudits.set(a.id, a);
    return a;
  },
  async listTutorResponseAudits(): Promise<TutorResponseAudit[]> {
    return Array.from(getStore().tutorResponseAudits.values());
  },
  async appendHomeworkInputAudit(a) {
    getStore().homeworkInputAudits.set(a.id, a);
    return a;
  },
  async listHomeworkInputAudits(): Promise<HomeworkInputAudit[]> {
    return Array.from(getStore().homeworkInputAudits.values());
  },
};
