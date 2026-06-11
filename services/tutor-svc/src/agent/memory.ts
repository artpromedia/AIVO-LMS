/**
 * Wave E (S12) — episodic tutor memory: the `remember` tool + retrieval.
 *
 * The memory loop is the most privacy-sensitive agent capability, so it
 * is quadruple-gated:
 *   1. CONSENT  — sessions only open behind the BFF's ai_personalization
 *      consent guard; the open route records that fact in agent_state and
 *      the orchestrator refuses memory writes without it.
 *   2. POLICY   — the tutor must declare memoryPolicy.canRemember, and
 *      each write's kind must be in BOTH the closed MEMORY_KINDS
 *      vocabulary and the tutor's declared kinds.
 *   3. BOUNDS   — ≤2 writes per session (orchestrator cap), content
 *      3–300 chars, every row expires after 180 days (admin-svc purge).
 *   4. VISIBILITY — every row is parent-visible and parent-deletable
 *      (web memory card), and erased with the learner (ADR 0034).
 *
 * Retrieval is read-side bounded too: top-k=5 newest unexpired rows for
 * (learner, tutor), rendered as a compact context block.
 */
import { MEMORY_KINDS, type MemoryKind } from "@aivo/tutor-sdk";

export const MEMORY_TTL_DAYS = 180;
export const MAX_MEMORY_WRITES_PER_SESSION = 2;
export const MEMORY_TOP_K = 5;
export const MAX_MEMORY_CONTENT_CHARS = 300;

export interface TutorMemoryRow {
  id: string;
  kind: string;
  content: string;
  createdAt: Date | string;
  expiresAt: Date | string;
}

export interface MemoryInsertInput {
  tenantId: string;
  learnerId: string;
  tutorKey: string;
  sessionId: string;
  kind: MemoryKind;
  content: string;
  expiresAt: Date;
}

export interface MemoryDeps {
  insertMemory(input: MemoryInsertInput): Promise<void>;
  /** Newest-first unexpired rows for (tenant, learner, tutor), max `k`. */
  listMemories(input: {
    tenantId: string;
    learnerId: string;
    tutorKey: string;
    k: number;
  }): Promise<TutorMemoryRow[]>;
}

export const REMEMBER_TOOL_SCHEMA = {
  description:
    "Remember ONE short, parent-visible note about this learner for future sessions (what helps, safe interests, gentle-approach triggers, wins). Use sparingly — at most twice per session.",
  parameters: {
    type: "object",
    properties: {
      kind: { type: "string", enum: [...MEMORY_KINDS] },
      content: {
        type: "string",
        description: "3–300 chars, plain language a parent would be glad to read. No PII.",
      },
    },
    required: ["kind", "content"],
    additionalProperties: false,
  },
} as const;

export function memoryExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + MEMORY_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** Execute one `remember` write. Validation errors resolve to `{ error }`. */
export async function executeRememberTool(
  args: Record<string, unknown>,
  ctx: {
    tenantId: string;
    sessionId: string;
    learnerId: string;
    tutorKey: string;
    /** The tutor's declared memoryPolicy.kinds. */
    allowedKinds: readonly string[];
  },
  deps: Pick<MemoryDeps, "insertMemory">,
): Promise<Record<string, unknown>> {
  try {
    const kind = String(args.kind ?? "");
    if (!(MEMORY_KINDS as readonly string[]).includes(kind)) {
      return { error: `kind must be one of ${MEMORY_KINDS.join(", ")}` };
    }
    if (!ctx.allowedKinds.includes(kind)) {
      return { error: `this tutor's memory policy does not allow kind "${kind}"` };
    }
    const content = typeof args.content === "string" ? args.content.trim() : "";
    if (content.length < 3 || content.length > MAX_MEMORY_CONTENT_CHARS) {
      return { error: `content must be 3–${MAX_MEMORY_CONTENT_CHARS} chars` };
    }
    const expiresAt = memoryExpiry();
    await deps.insertMemory({
      tenantId: ctx.tenantId,
      learnerId: ctx.learnerId,
      tutorKey: ctx.tutorKey,
      sessionId: ctx.sessionId,
      kind: kind as MemoryKind,
      content,
      expiresAt,
    });
    return {
      remembered: true,
      kind,
      expires_at: expiresAt.toISOString(),
      note: "saved — visible to the learner's parent, expires in 180 days",
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/** Render retrieved memories as a compact persona-context block. */
export function renderMemoryContext(rows: TutorMemoryRow[]): string {
  if (rows.length === 0) return "";
  const lines = rows
    .slice(0, MEMORY_TOP_K)
    .map((r) => `- [${r.kind}] ${r.content.slice(0, MAX_MEMORY_CONTENT_CHARS)}`);
  return ["Known about this learner (from earlier sessions; parent-visible):", ...lines].join(
    "\n",
  );
}
