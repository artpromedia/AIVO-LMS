/**
 * Legacy `@aivo/ops-alert`-compatible adapter (Sprint 7 Task #69, v2.1 §9.1
 * dedup). Lets call sites that were written against the old single-file
 * client move to `@aivo/ops-alerts` without rewriting their alert payloads.
 *
 * Old shape:
 *   getOpsAlertClient().send({ severity, title, body, dedupKey, fields })
 *     → { delivered, deduped, status? }
 *
 * New shape (under the hood):
 *   client.page({ severity, title, message, context })
 *     → { delivered, queued }
 *
 * The bridge:
 *   - accepts the legacy payload
 *   - implements per-key TTL dedup (default 1h) above `client.page()`
 *   - merges `body` + `fields` into the new `message`/`context` shape
 *   - returns the legacy `{ delivered, deduped }` result so callers don't
 *     need to change their typing.
 */
import type { OpsAlertClient } from "./client.js";
import type { OpsAlertSeverity } from "./types.js";

export type LegacyAlertSeverity = OpsAlertSeverity;

export interface LegacyOpsAlert {
  severity: LegacyAlertSeverity;
  title: string;
  body: string;
  /** Suppress duplicate alerts with the same key within `dedupWindowMs`. */
  dedupKey?: string;
  /** Free-form fields forwarded into `context.fields` on the new envelope. */
  fields?: Record<string, string | number | boolean | null>;
}

export interface LegacyOpsAlertSendResult {
  delivered: boolean;
  deduped: boolean;
  /** Always `true` if the new client deferred to the durable outbox. */
  queued?: boolean;
}

export interface LegacyOpsAlertClientOptions {
  client: OpsAlertClient;
  /** Dedup window in ms. Default 60 minutes. */
  dedupWindowMs?: number;
  /** Override for the clock — used by tests. */
  now?: () => number;
}

const DEFAULT_DEDUP_MS = 60 * 60 * 1000;

/**
 * Wraps an `OpsAlertClient` in the legacy `send()`-style API. One instance
 * per service is enough; the dedup table is in-process only (the new
 * `OpsAlertClient` already handles cross-replica durability via the outbox
 * + alerts-proxy-svc, so no additional persistence is needed for dedup).
 */
export class LegacyOpsAlertClient {
  private readonly client: OpsAlertClient;
  private readonly dedupWindowMs: number;
  private readonly now: () => number;
  private readonly recentlySent = new Map<string, number>();

  constructor(opts: LegacyOpsAlertClientOptions) {
    this.client = opts.client;
    this.dedupWindowMs = opts.dedupWindowMs ?? DEFAULT_DEDUP_MS;
    this.now = opts.now ?? (() => Date.now());
  }

  async send(alert: LegacyOpsAlert): Promise<LegacyOpsAlertSendResult> {
    if (alert.dedupKey) {
      const last = this.recentlySent.get(alert.dedupKey);
      if (last !== undefined && this.now() - last < this.dedupWindowMs) {
        return { delivered: false, deduped: true };
      }
    }

    const context: Record<string, unknown> = {};
    if (alert.fields) context.fields = alert.fields;
    if (alert.dedupKey) context.dedupKey = alert.dedupKey;
    // The legacy `body` was the human-readable detail; keep it as `message`
    // so existing alert renderers still see the same string.
    const result = await this.client.page({
      severity: alert.severity,
      title: alert.title,
      message: alert.body,
      context: Object.keys(context).length > 0 ? context : undefined,
    });

    if (alert.dedupKey) this.recentlySent.set(alert.dedupKey, this.now());

    return {
      delivered: result.delivered,
      deduped: false,
      queued: result.queued,
    };
  }

  /**
   * Test-only — clears the dedup table. Production code should never need
   * to call this; the entries are bounded by the dedup window.
   */
  _resetDedup(): void {
    this.recentlySent.clear();
  }
}

/**
 * Convenience factory mirroring the legacy `createOpsAlertClient()` /
 * `getOpsAlertClient()` shape. Pass an `OpsAlertClient` (typically the one
 * created by `bootstrapOpsAlerts`) and you get back a `.send()`-style
 * client.
 */
export function createLegacyOpsAlertClient(
  opts: LegacyOpsAlertClientOptions,
): LegacyOpsAlertClient {
  return new LegacyOpsAlertClient(opts);
}
