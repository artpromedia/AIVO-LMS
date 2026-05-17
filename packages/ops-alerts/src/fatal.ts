import { createLogger } from "@aivo/observability";
import type { OpsAlertClient } from "./client.js";

const logger = createLogger("ops-alerts:fatal");

export interface InstallFatalPagerOptions {
  client: OpsAlertClient;
  service: string;
  /** Time budget for the in-process flush before exit. Default 3_000. */
  flushWindowMs?: number;
  /** Override exit so tests don't kill the worker. */
  exit?: (code: number) => void;
}

/**
 * Wire `uncaughtException` and `unhandledRejection` to ship a critical page via
 * the OpsAlertClient before the process exits. The page is enqueued
 * synchronously by the client (via the durable outbox if configured) so a
 * subsequent restart can drain it.
 */
export function installFatalErrorPager(opts: InstallFatalPagerOptions): () => void {
  const flushWindowMs = opts.flushWindowMs ?? 3_000;
  const exit = opts.exit ?? ((code: number) => process.exit(code));
  let firing = false;

  const fire = async (kind: "uncaughtException" | "unhandledRejection", err: unknown) => {
    if (firing) return;
    firing = true;
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    logger.error("ops_alert.fatal.caught", { kind, err: message });
    try {
      await opts.client.page({
        severity: "critical",
        title: `${opts.service} fatal: ${kind}`,
        message: message.slice(0, 500),
        context: { kind, service: opts.service, stack: stack?.slice(0, 4000) },
      });
      await Promise.race([
        opts.client.flushOutbox(),
        new Promise((resolve) => setTimeout(resolve, flushWindowMs)),
      ]);
    } catch (pageErr: any) {
      logger.error("ops_alert.fatal.page_failed", { err: pageErr?.message });
    }
    exit(1);
  };

  const onException = (err: Error) => {
    void fire("uncaughtException", err);
  };
  const onRejection = (reason: unknown) => {
    void fire("unhandledRejection", reason);
  };

  process.on("uncaughtException", onException);
  process.on("unhandledRejection", onRejection);

  return () => {
    process.off("uncaughtException", onException);
    process.off("unhandledRejection", onRejection);
  };
}
