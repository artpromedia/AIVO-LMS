/**
 * Canonical audit-event schema (Sprint B4).
 *
 * Zod mirror of {@link AuditEventInput} (`event.ts`) — the producer-side
 * shape; chain fields (`prev_hash`/`hash`) are assigned by audit-svc on
 * append and are deliberately absent here. `createAuditClient.emit`
 * validates every event against this schema before send: in development
 * an invalid event throws ({@link AuditSchemaError}) so producers fail
 * loudly; in production the event still emits, marked with
 * `schema_violation` details, so nothing is ever silently dropped.
 */
import { z } from "zod";
import type { AuditEventInput } from "./event.js";

/** Dot-namespaced action, e.g. `identity.idp.created` (≥ 2 segments). */
export const AUDIT_ACTION_PATTERN = /^[a-z0-9_-]+(\.[a-z0-9_-]+)+$/;

export const auditActorSchema = z.object({
  // May be "" for unauthenticated principals (e.g. a failed login probe) —
  // the event is still worth keeping, with outcome "failure".
  id: z.string().max(255),
  role: z.string().max(64),
  ip: z.string().max(64),
  ua: z.string().max(1024),
});

export const auditEntitySchema = z.object({
  type: z.string().min(1).max(64),
  // "" allowed: list-level operations have no single entity id.
  id: z.string().max(255),
});

export const auditEventInputSchema = z.object({
  id: z.string().uuid().optional(),
  occurred_at: z.string().datetime({ offset: true }),
  tenant_id: z.string().min(1).max(64).nullable(),
  actor: auditActorSchema,
  action: z.string().regex(AUDIT_ACTION_PATTERN, "action must be dot.namespaced lowercase"),
  entity: auditEntitySchema,
  outcome: z.enum(["success", "failure"]),
  details: z.record(z.string(), z.unknown()),
  request_id: z.string().max(255),
});

export interface AuditSchemaResult {
  ok: boolean;
  /** Flat `path: message` strings — safe to log (never contains values). */
  issues: string[];
}

export class AuditSchemaError extends Error {
  constructor(public readonly issues: string[]) {
    super(`audit event failed schema validation: ${issues.join("; ")}`);
    this.name = "AuditSchemaError";
  }
}

/** Validate a fully-built producer event. Never throws. */
export function validateAuditEventInput(event: AuditEventInput): AuditSchemaResult {
  const parsed = auditEventInputSchema.safeParse(event);
  if (parsed.success) return { ok: true, issues: [] };
  const issues = parsed.error.issues.map(
    (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
  );
  return { ok: false, issues };
}
