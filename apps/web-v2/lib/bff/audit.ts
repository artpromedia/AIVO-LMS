import { recordAudit } from "@/lib/db/repos";
import { logger } from "@/lib/observability/logger";
import type { SessionProfile } from "@/lib/auth/types";

/**
 * Audit an action performed by a session. Writes to the store and logs.
 * Call this from any BFF route that mutates state.
 */
export function audit(
  session: SessionProfile | null,
  action: string,
  requestId: string,
  extras?: { learnerId?: string | null; metadata?: Record<string, unknown> },
) {
  const entry = recordAudit({
    userId: session?.userId ?? null,
    tenantId: session?.tenantId ?? null,
    learnerId: extras?.learnerId ?? null,
    action,
    metadata: extras?.metadata,
    requestId,
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
