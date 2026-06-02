/**
 * `audit.emit` — the producer-side helper every service uses to append an
 * audit event (Sprint 3).
 *
 * Emission is best-effort and non-blocking on the request path: a failure to
 * reach audit-svc is logged but never breaks the user's action. The chain
 * (`prev_hash`/`hash`) is assigned by audit-svc on append, so producers send
 * an {@link AuditEventInput}.
 */
import { uuidv7, type AuditEventInput } from "./event.js";
import { redactDetails } from "./redact.js";

export interface AuditTransport {
  send(event: AuditEventInput): Promise<void>;
}

/** HTTP transport: POST to audit-svc `/events` with a service JWT. */
export class HttpAuditTransport implements AuditTransport {
  constructor(
    private readonly cfg: {
      url: string;
      serviceToken: string;
      fetchImpl?: typeof fetch;
      timeoutMs?: number;
    },
  ) {}

  async send(event: AuditEventInput): Promise<void> {
    const fetchImpl = this.cfg.fetchImpl ?? fetch;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.cfg.timeoutMs ?? 3000);
    try {
      const res = await fetchImpl(`${this.cfg.url.replace(/\/$/, "")}/events`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.cfg.serviceToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(event),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`audit emit failed: ${res.status}`);
    } finally {
      clearTimeout(timer);
    }
  }
}

export interface AuditClientOptions {
  transport: AuditTransport;
  /** Default allowlist applied to `details` when an event omits its own. */
  defaultAllowlist?: readonly string[];
  /** Called when emission throws (never rethrown to the caller). */
  onError?: (err: unknown, event: AuditEventInput) => void;
}

export interface EmitInput extends Omit<AuditEventInput, "id" | "occurred_at" | "details"> {
  id?: string;
  occurred_at?: string;
  details?: Record<string, unknown>;
  /** Per-event allowlist for `details` (overrides the client default). */
  detailsAllowlist?: readonly string[];
}

export interface AuditClient {
  emit(input: EmitInput): Promise<AuditEventInput>;
}

export function createAuditClient(opts: AuditClientOptions): AuditClient {
  return {
    async emit(input) {
      const allow = input.detailsAllowlist ?? opts.defaultAllowlist ?? [];
      const event: AuditEventInput = {
        id: input.id ?? uuidv7(),
        occurred_at: input.occurred_at ?? new Date().toISOString(),
        tenant_id: input.tenant_id,
        actor: input.actor,
        action: input.action,
        entity: input.entity,
        outcome: input.outcome,
        details: redactDetails(input.details, allow),
        request_id: input.request_id,
      };
      try {
        await opts.transport.send(event);
      } catch (err) {
        if (opts.onError) opts.onError(err, event);
        // best-effort: swallow so audit emission never breaks the request
      }
      return event;
    },
  };
}
