/**
 * safety / moderation — memory == postgres parity (Sprint 7).
 *
 * Moderation events (append-only) auto-open a human-review case on
 * review/crisis/sensitive-block; cases are mutable (resolve stamps
 * resolvedAt); blocked generations + tutor/homework audits are append-only.
 */
import { it, expect } from "vitest";
import {
  recordModerationEvent,
  listModerationEvents,
  getModerationEvent,
  listHumanReviewCases,
  updateHumanReviewCase,
  recordBlockedGeneration,
  listBlockedGenerations,
  recordTutorResponseAudit,
  listTutorResponseAudits,
} from "@/lib/db/repos";
import { runInBothModes } from "./parity.harness";

const T = "t_safety_parity";

const cls = (decision: "allow" | "review" | "block", categories: string[] = []) =>
  ({ decision, categories, severity: decision === "block" ? "high" : "low" }) as never;

runInBothModes("safety", () => {
  it("review decision auto-opens a human-review case; allow does not", async () => {
    const review = await recordModerationEvent({
      tenantId: T,
      learnerId: "lrn-s",
      subjectKind: "tutor_response" as never,
      subjectRefId: null,
      excerpt: "x".repeat(800),
      classification: cls("review"),
      injectionSignals: [],
      crisisSignals: [],
      createdByUserId: null,
    });
    expect(review.reviewCase).not.toBeNull();
    // excerpt capped at 500
    expect(review.event.excerpt.length).toBe(500);
    expect((await getModerationEvent(review.event.id))?.id).toBe(review.event.id);

    const allow = await recordModerationEvent({
      tenantId: T,
      learnerId: "lrn-s",
      subjectKind: "tutor_response" as never,
      subjectRefId: null,
      excerpt: "fine",
      classification: cls("allow"),
      injectionSignals: [],
      crisisSignals: [],
      createdByUserId: null,
    });
    expect(allow.reviewCase).toBeNull();

    // tenant-filtered moderation list sees both events
    const events = await listModerationEvents({ tenantId: T });
    expect(events.filter((e) => e.tenantId === T).length).toBeGreaterThanOrEqual(2);
  });

  it("crisis signal opens an escalated case; resolve stamps resolvedAt", async () => {
    const r = await recordModerationEvent({
      tenantId: T,
      learnerId: "lrn-s",
      subjectKind: "learner_message" as never,
      subjectRefId: null,
      excerpt: "help",
      classification: cls("block", ["self_harm"]),
      injectionSignals: [],
      crisisSignals: ["self_harm_intent"] as never,
      createdByUserId: null,
    });
    expect(r.reviewCase?.escalatedAt).not.toBeNull();
    const resolved = await updateHumanReviewCase(r.reviewCase!.id, {
      status: "resolved_block",
      resolvedByUserId: "u_safety",
    });
    expect(resolved?.status).toBe("resolved_block");
    expect(resolved?.resolvedAt).not.toBeNull();
    expect((await listHumanReviewCases({ tenantId: T })).some((c) => c.id === r.reviewCase!.id)).toBe(
      true,
    );
  });

  it("blocked generations + tutor audits append and list tenant-scoped", async () => {
    await recordBlockedGeneration({
      tenantId: T,
      learnerId: null,
      subjectKind: "tutor_response" as never,
      reason: "policy",
      fallbackResponse: "Let's try something else.",
    });
    expect((await listBlockedGenerations(T)).length).toBeGreaterThanOrEqual(1);

    await recordTutorResponseAudit({
      tenantId: T,
      learnerId: "lrn-s",
      contextKind: "lesson_run",
      contextRefId: "lr-1",
      tutorPersona: "Nimbus",
      excerpt: "y".repeat(800),
      classification: cls("allow"),
    });
    const audits = await listTutorResponseAudits(T);
    expect(audits[0]!.excerpt.length).toBe(500);
  });
});
