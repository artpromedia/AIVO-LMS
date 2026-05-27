import { recordAudit } from "@/lib/db/repos";
import { logger } from "@/lib/observability/logger";
import type { SessionProfile } from "@/lib/auth/types";
import type { AuditLog } from "@/lib/db/types";
import { newId, nowIso } from "@/lib/db/store";

/**
 * Audit an action performed by a session. Synthesises the log row
 * synchronously (so callers can use its id immediately) and fires the
 * persistence write in the background — audit writes must be durable
 * but never block the user-facing request. Failure to persist is
 * surfaced as a structured `audit.persist_failed` log entry rather
 * than a thrown error.
 *
 * The persistence adapter (ADR 0007) routes the underlying write
 * through the memory store by default; flipping
 * AIVO_PERSISTENCE_AUDIT=postgres routes through Drizzle. The
 * fire-and-forget semantics are unchanged in either mode.
 */
export function audit(
  session: SessionProfile | null,
  action: string,
  requestId: string,
  extras?: { learnerId?: string | null; metadata?: Record<string, unknown> },
): AuditLog {
  const entry: AuditLog = {
    id: newId("aud"),
    userId: session?.userId ?? null,
    tenantId: session?.tenantId ?? null,
    learnerId: extras?.learnerId ?? null,
    action,
    metadata: extras?.metadata ?? {},
    requestId,
    occurredAt: nowIso(),
  };
  // Kick off the write but do not await — the audit row is durable
  // best-effort, never on the request critical path.
  recordAudit({
    userId: entry.userId,
    tenantId: entry.tenantId,
    learnerId: entry.learnerId,
    action: entry.action,
    metadata: entry.metadata,
    requestId: entry.requestId,
  })
    .then((persisted) => {
      // recordAudit re-synthesises the id; keep the entry we returned
      // to the caller as the authoritative one (it's already logged
      // below) — `persisted` exists for parity with the future
      // postgres path that may attach DB-side defaults.
      void persisted;
    })
    .catch((err) => {
      logger.error(
        {
          event: "audit.persist_failed",
          requestId,
          action,
          tenantId: entry.tenantId,
          userId: entry.userId,
          message: err instanceof Error ? err.message : String(err),
        },
        "[audit] persistence write failed",
      );
    });

  logger.info(
    {
      requestId,
      userId: entry.userId,
      tenantId: entry.tenantId,
      learnerId: entry.learnerId,
      action: entry.action,
    },
    "[audit]",
  );
  return entry;
}
