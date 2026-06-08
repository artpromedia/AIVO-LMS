/**
 * Drizzle-backed SafetyStore — the web_* moderation / safety tables. Moderation
 * events + tutor/homework audits are append-only; human-review cases are
 * mutable. Filtering/sorting + the auto-review-case orchestration live in the
 * repo layer, so this is a plain row store.
 */
import { eq } from "drizzle-orm";
import {
  webSafetyPolicyVersions,
  webModerationEvents,
  webHumanReviewCases,
  webBlockedGenerations,
  webTutorResponseAudits,
  webHomeworkInputAudits,
} from "@aivo/db";
import type {
  BlockedGeneration,
  HomeworkInputAudit,
  HumanReviewCase,
  ModerationEvent,
  SafetyPolicyVersion,
  TutorResponseAudit,
} from "@/lib/db/types";
import type { SafetyStore } from "../types";
import { getDb } from "./client";

export const drizzleSafety: SafetyStore = {
  async listSafetyPolicyVersions(): Promise<SafetyPolicyVersion[]> {
    const rows = await getDb().select().from(webSafetyPolicyVersions);
    return rows.map((r) => r.data as SafetyPolicyVersion);
  },
  async appendModerationEvent(event) {
    await getDb()
      .insert(webModerationEvents)
      .values({ id: event.id, tenantId: event.tenantId, data: event })
      .onConflictDoNothing({ target: webModerationEvents.id });
    return event;
  },
  async getModerationEvent(id) {
    const [row] = await getDb()
      .select()
      .from(webModerationEvents)
      .where(eq(webModerationEvents.id, id))
      .limit(1);
    return row ? (row.data as ModerationEvent) : null;
  },
  async listModerationEvents(): Promise<ModerationEvent[]> {
    const rows = await getDb().select().from(webModerationEvents);
    return rows.map((r) => r.data as ModerationEvent);
  },
  async upsertHumanReviewCase(c) {
    await getDb()
      .insert(webHumanReviewCases)
      .values({ id: c.id, tenantId: c.tenantId, data: c })
      .onConflictDoUpdate({ target: webHumanReviewCases.id, set: { tenantId: c.tenantId, data: c } });
    return c;
  },
  async getHumanReviewCase(id) {
    const [row] = await getDb()
      .select()
      .from(webHumanReviewCases)
      .where(eq(webHumanReviewCases.id, id))
      .limit(1);
    return row ? (row.data as HumanReviewCase) : null;
  },
  async listHumanReviewCases(): Promise<HumanReviewCase[]> {
    const rows = await getDb().select().from(webHumanReviewCases);
    return rows.map((r) => r.data as HumanReviewCase);
  },
  async appendBlockedGeneration(b) {
    await getDb()
      .insert(webBlockedGenerations)
      .values({ id: b.id, tenantId: b.tenantId, data: b })
      .onConflictDoNothing({ target: webBlockedGenerations.id });
    return b;
  },
  async listBlockedGenerations(): Promise<BlockedGeneration[]> {
    const rows = await getDb().select().from(webBlockedGenerations);
    return rows.map((r) => r.data as BlockedGeneration);
  },
  async appendTutorResponseAudit(a) {
    await getDb()
      .insert(webTutorResponseAudits)
      .values({ id: a.id, tenantId: a.tenantId, data: a })
      .onConflictDoNothing({ target: webTutorResponseAudits.id });
    return a;
  },
  async listTutorResponseAudits(): Promise<TutorResponseAudit[]> {
    const rows = await getDb().select().from(webTutorResponseAudits);
    return rows.map((r) => r.data as TutorResponseAudit);
  },
  async appendHomeworkInputAudit(a) {
    await getDb()
      .insert(webHomeworkInputAudits)
      .values({ id: a.id, tenantId: a.tenantId, data: a })
      .onConflictDoNothing({ target: webHomeworkInputAudits.id });
    return a;
  },
  async listHomeworkInputAudits(): Promise<HomeworkInputAudit[]> {
    const rows = await getDb().select().from(webHomeworkInputAudits);
    return rows.map((r) => r.data as HomeworkInputAudit);
  },
};
