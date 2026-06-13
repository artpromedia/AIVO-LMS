/**
 * Sprint C-14 — reveal instrumentation relay.
 *
 * The stitched reveal fires client-side events (reveal_started, screen_advanced,
 * ceremony_reached, share_artifact_created) here. We record each as an
 * append-only `audit_logs` row under the `reveal.*` action namespace — the
 * durable, timestamped, tenant-scoped event log that already exists (there is no
 * separate product-analytics warehouse in web-v2). The funnel read-path
 * (`computeRevealFunnel`) reads those rows back. `approved`/`amended` are NOT
 * accepted here — they are derived server-side from the authoritative approval
 * record at approval time, so a forged client POST can't inflate conversion.
 *
 * Best-effort: always 204 so the client never reschedules; scope-checked so a
 * parent can only record events for their own learner.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { failFromUnknown, getRequestId } from "@/lib/bff/response";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { revealAction } from "@/lib/learner/reveal-telemetry";
import { logger } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

// Only the client-fireable events. Terminal approve/amend are server-derived.
const ClientEventSchema = z.object({
  event: z.enum(["reveal_started", "screen_advanced", "corrections_opened", "ceremony_reached", "share_artifact_created"]),
  screen: z.number().int().min(1).max(7).optional(),
});

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent"], requestId);
    if (roleErr) return roleErr;
    const scope = await requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;

    const raw = await req.json().catch(() => ({}));
    const parsed = ClientEventSchema.safeParse(raw);
    if (!parsed.success) {
      // Bad payloads are dropped silently (204) — telemetry must never surface
      // an error to the user mid-reveal.
      return new NextResponse(null, { status: 204 });
    }

    audit(session!, revealAction(parsed.data.event), requestId, {
      learnerId,
      metadata: {
        ...(parsed.data.screen !== undefined ? { screen: parsed.data.screen } : {}),
        surface: "reveal",
      },
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    logger.warn({ requestId, err: String(e) }, "reveal-telemetry relay error");
    return failFromUnknown(e, requestId);
  }
}
