/**
 * Executive-function session-outcome ledger writer.
 *
 * Single shared write path into `ef_session_outcomes`, used by both the
 * explicit `POST /api/ef/session-outcome` endpoint and the live tutor
 * session-completion hook in `chat.ts`. Centralising the insert here keeps
 * the clamping / time-of-day bucketing identical across both callers so the
 * best-window query and the parent "what's working" dashboard see uniformly
 * shaped rows regardless of which path produced them.
 */
import { efSessionOutcomes } from "@aivo/db";
import { bucketLocalHour } from "@aivo/executive-function";

const EF_MODALITIES = new Set(["visual", "auditory", "kinesthetic", "reading"]);

/** Coerce to a finite 0..1 value (ledger accuracy / frustrationRate domain). */
export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** Only the four EF modalities are valid ledger values; anything else → null. */
export function normalizeEfModality(value: unknown): string | null {
  return typeof value === "string" && EF_MODALITIES.has(value) ? value : null;
}

export interface EfSessionOutcomeInput {
  tenantId: string;
  learnerId: string;
  startedAt: Date;
  /** Learner-local hour (0–23); falls back to `startedAt.getHours()`. */
  localHour?: number | null;
  subject?: string | null;
  modality?: string | null;
  accuracy: number;
  frustrationRate?: number;
  attentionMinutes?: number;
}

/**
 * Insert one row into the `ef_session_outcomes` ledger. Returns the new row id
 * plus the derived time-of-day bucket. Callers that want this to be
 * best-effort (e.g. the session-completion hook) should wrap the call in their
 * own try/catch — this function does not swallow errors.
 */
export async function recordEfSessionOutcome(
  db: any,
  input: EfSessionOutcomeInput,
): Promise<{ id: string; timeOfDay: ReturnType<typeof bucketLocalHour> }> {
  const hour =
    typeof input.localHour === "number" && input.localHour >= 0 && input.localHour <= 23
      ? input.localHour
      : input.startedAt.getHours();
  const timeOfDay = bucketLocalHour(hour);
  const subject = input.subject ? String(input.subject).slice(0, 64) : null;

  const [row] = await db
    .insert(efSessionOutcomes)
    .values({
      tenantId: input.tenantId,
      learnerId: input.learnerId,
      startedAt: input.startedAt,
      timeOfDay,
      subject,
      modality: normalizeEfModality(input.modality),
      accuracy: clamp01(input.accuracy),
      frustrationRate: clamp01(input.frustrationRate ?? 0),
      attentionMinutes: Math.max(0, Math.min(1440, Math.round(input.attentionMinutes ?? 0))),
    })
    .returning();

  return { id: row.id as string, timeOfDay };
}
