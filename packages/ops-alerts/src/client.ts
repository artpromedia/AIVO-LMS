import { randomUUID } from "node:crypto";
import { createLogger } from "@aivo/observability";
import type {
  OpsAlertEnvelope,
  OpsAlertOutboxStats,
  OpsAlertOutboxStore,
  OpsAlertSeverity,
  ShutdownDrainOutcome,
} from "./types.js";

const logger = createLogger("ops-alert-client");

export interface OpsAlertClientOptions {
  service: string;
  proxyUrl: string;
  outbox: OpsAlertOutboxStore;
  fetchImpl?: typeof fetch;
  /** Auto-flush interval in ms; 0 disables. Default 30_000. */
  autoFlushIntervalMs?: number;
  /** Per-attempt fetch timeout in ms. Default 5_000. */
  attemptTimeoutMs?: number;
  /** Hook fired after every auto-flush tick (for tests / dashboards). */
  onAutoFlush?: (info: { drained: number; error: Error | null }) => void;
  /** Optional pre-instantiated logger (uses default if omitted). */
  logger?: ReturnType<typeof createLogger>;
}

export class OpsAlertClient {
  private readonly opts: Required<
    Omit<OpsAlertClientOptions, "onAutoFlush" | "logger" | "fetchImpl">
  > & {
    onAutoFlush?: OpsAlertClientOptions["onAutoFlush"];
    fetchImpl: typeof fetch;
    logger: ReturnType<typeof createLogger>;
  };
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly stats = {
    enqueuedTotal: 0,
    drainedTotal: 0,
    droppedTotal: 0,
    firstNonZeroAt: null as string | null,
    lastEnqueuedAt: null as string | null,
    lastDrainedAt: null as string | null,
    lastDropReason: null as string | null,
    autoFlushTicksTotal: 0,
    autoFlushDrainedTotal: 0,
    autoFlushErrorsTotal: 0,
    lastAutoFlushAt: null as string | null,
    lastShutdown: null as ShutdownDrainOutcome | null,
  };

  constructor(options: OpsAlertClientOptions) {
    this.opts = {
      service: options.service,
      proxyUrl: options.proxyUrl.replace(/\/$/, ""),
      outbox: options.outbox,
      fetchImpl: options.fetchImpl ?? fetch,
      autoFlushIntervalMs: options.autoFlushIntervalMs ?? 30_000,
      attemptTimeoutMs: options.attemptTimeoutMs ?? 5_000,
      onAutoFlush: options.onAutoFlush,
      logger: options.logger ?? logger,
    };
  }

  startAutoFlush(): void {
    if (this.timer || this.opts.autoFlushIntervalMs <= 0) return;
    this.timer = setInterval(() => {
      this.tick().catch(() => {
        // tick() is itself defensive — but guard the unhandled rejection.
      });
    }, this.opts.autoFlushIntervalMs);
    if (typeof this.timer === "object" && this.timer && "unref" in this.timer) {
      (this.timer as any).unref();
    }
  }

  stopAutoFlush(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    this.stats.autoFlushTicksTotal++;
    this.stats.lastAutoFlushAt = new Date().toISOString();
    let drained = 0;
    let error: Error | null = null;
    try {
      const result = await this.flushOutbox();
      drained = result.drained;
      this.stats.autoFlushDrainedTotal += drained;
    } catch (err: any) {
      this.stats.autoFlushErrorsTotal++;
      error = err instanceof Error ? err : new Error(String(err));
      this.opts.logger.warn("ops_alert.auto_flush_error", {
        err: error.message,
        service: this.opts.service,
      });
    }
    this.opts.onAutoFlush?.({ drained, error });
  }

  async page(input: {
    severity: OpsAlertSeverity;
    title: string;
    message: string;
    context?: Record<string, unknown>;
  }): Promise<{ delivered: boolean; queued: boolean }> {
    const envelope: OpsAlertEnvelope = {
      id: randomUUID(),
      service: this.opts.service,
      severity: input.severity,
      title: input.title,
      message: input.message,
      context: input.context,
      occurredAt: new Date().toISOString(),
      attempt: 0,
    };

    const delivered = await this.deliver(envelope);
    if (delivered) return { delivered: true, queued: false };

    await this.opts.outbox.enqueue(envelope);
    this.stats.enqueuedTotal++;
    this.stats.lastEnqueuedAt = envelope.occurredAt;
    if (!this.stats.firstNonZeroAt) this.stats.firstNonZeroAt = envelope.occurredAt;
    this.opts.logger.warn("ops_alert.queued", {
      service: this.opts.service,
      alertId: envelope.id,
      severity: envelope.severity,
    });
    return { delivered: false, queued: true };
  }

  private async deliver(envelope: OpsAlertEnvelope): Promise<boolean> {
    const body = JSON.stringify(envelope);
    try {
      const res = await this.opts.fetchImpl(`${this.opts.proxyUrl}/api/alerts/page`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        // Cast to satisfy both DOM and undici fetch typings — they
        // disagree on the exact shape of AbortSignal but accept the
        // standard global one at runtime.
        signal: AbortSignal.timeout(this.opts.attemptTimeoutMs) as unknown as RequestInit["signal"],
      });
      if (!res.ok) return false;
      this.stats.drainedTotal++;
      this.stats.lastDrainedAt = new Date().toISOString();
      return true;
    } catch {
      return false;
    }
  }

  async flushOutbox(): Promise<{ drained: number; remaining: number }> {
    return this.opts.outbox.drain(async (envelope) => {
      const ok = await this.deliver({ ...envelope, attempt: envelope.attempt + 1 });
      if (!ok) throw new Error("delivery failed");
    });
  }

  /**
   * Drain whatever is queued, give up after `windowMs`. If a durable store is
   * supplied, envelopes still queued at the deadline are persisted there
   * before exit so they survive across restarts (#196).
   */
  async drainForShutdown(opts: {
    windowMs: number;
    durableStore?: OpsAlertOutboxStore;
  }): Promise<ShutdownDrainOutcome> {
    const startedAt = new Date().toISOString();
    const deadline = Date.now() + Math.max(0, opts.windowMs);
    let drained = 0;
    let flushTimedOut = false;

    while (Date.now() < deadline) {
      const remainingBefore = await this.opts.outbox.size();
      if (remainingBefore === 0) break;
      let drainedThisPass = 0;
      try {
        const result = await this.opts.outbox.drain(async (envelope) => {
          if (Date.now() >= deadline) throw new Error("shutdown deadline reached");
          const ok = await this.deliver({ ...envelope, attempt: envelope.attempt + 1 });
          if (!ok) throw new Error("delivery failed");
        });
        drainedThisPass = result.drained;
      } catch {
        // delivery failure leaves the head of the queue in place; the next
        // loop iteration sees the same remainingBefore and exits below.
      }
      drained += drainedThisPass;
      const remainingAfter = await this.opts.outbox.size();
      if (remainingAfter === remainingBefore) {
        flushTimedOut = true;
        break;
      }
    }

    let lost = 0;
    let persisted = 0;
    let leftover = await this.opts.outbox.size();
    if (leftover > 0 && opts.durableStore && opts.durableStore !== this.opts.outbox) {
      await this.opts.outbox.drain(async (envelope) => {
        await opts.durableStore!.enqueue(envelope);
        persisted++;
      });
      leftover = await this.opts.outbox.size();
    }
    if (leftover > 0) {
      lost = leftover;
      this.stats.droppedTotal += lost;
      this.stats.lastDropReason = "shutdown_timeout";
      this.opts.logger.error("ops_alert.dropped", {
        service: this.opts.service,
        count: lost,
        reason: "shutdown_timeout",
      });
    }

    const outcome: ShutdownDrainOutcome = {
      service: this.opts.service,
      drained,
      lost,
      persisted,
      flushTimedOut,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
    this.stats.lastShutdown = outcome;
    this.opts.logger.info(
      "ops_alert.shutdown_drain",
      outcome as unknown as Record<string, unknown>,
    );
    return outcome;
  }

  async stats_(): Promise<OpsAlertOutboxStats> {
    return {
      service: this.opts.service,
      storeKind: this.opts.outbox.kind,
      depth: await this.opts.outbox.size(),
      enqueuedTotal: this.stats.enqueuedTotal,
      drainedTotal: this.stats.drainedTotal,
      droppedTotal: this.stats.droppedTotal,
      firstNonZeroAt: this.stats.firstNonZeroAt,
      lastEnqueuedAt: this.stats.lastEnqueuedAt,
      lastDrainedAt: this.stats.lastDrainedAt,
      lastDropReason: this.stats.lastDropReason,
      autoFlushTicksTotal: this.stats.autoFlushTicksTotal,
      autoFlushDrainedTotal: this.stats.autoFlushDrainedTotal,
      autoFlushErrorsTotal: this.stats.autoFlushErrorsTotal,
      lastAutoFlushAt: this.stats.lastAutoFlushAt,
      lastShutdown: this.stats.lastShutdown,
    };
  }

  /** Test hook: trigger an auto-flush tick synchronously. */
  async triggerAutoFlushTickForTest(): Promise<void> {
    await this.tick();
  }
}
