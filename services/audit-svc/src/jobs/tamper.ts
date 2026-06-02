/**
 * Sprint 3 — tamper-detection job. Walks the chain and, on a break, raises
 * a platform-admin alert (via the injected sink: ops-alert + a self-audited
 * `audit.integrity.break` event). Returns the break (or null) so a cron
 * wrapper can record the run outcome.
 */
import type { EventStore } from "../services/event-store.js";
import type { ChainBreak } from "../lib/hashChain.js";

export interface TamperAlertSink {
  alert(breakInfo: ChainBreak): Promise<void>;
}

export async function runTamperCheckOnce(
  store: EventStore,
  sink: TamperAlertSink,
): Promise<ChainBreak | null> {
  const breakInfo = await store.verify();
  if (breakInfo) {
    await sink.alert(breakInfo);
  }
  return breakInfo;
}
