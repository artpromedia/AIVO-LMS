export type OpsAlertSeverity = "info" | "warning" | "critical";

export interface OpsAlertEnvelope {
  id: string;
  service: string;
  severity: OpsAlertSeverity;
  title: string;
  message: string;
  context?: Record<string, unknown>;
  occurredAt: string;
  attempt: number;
}

export interface OpsAlertOutboxStore {
  readonly kind: "memory" | "file" | "postgres";
  enqueue(envelope: OpsAlertEnvelope): Promise<void>;
  drain(
    handler: (envelope: OpsAlertEnvelope) => Promise<void>,
  ): Promise<{ drained: number; remaining: number }>;
  size(): Promise<number>;
}

export interface OpsAlertOutboxStats {
  service: string;
  storeKind: OpsAlertOutboxStore["kind"];
  depth: number;
  enqueuedTotal: number;
  drainedTotal: number;
  droppedTotal: number;
  firstNonZeroAt: string | null;
  lastEnqueuedAt: string | null;
  lastDrainedAt: string | null;
  lastDropReason: string | null;
  autoFlushTicksTotal: number;
  autoFlushDrainedTotal: number;
  autoFlushErrorsTotal: number;
  lastAutoFlushAt: string | null;
  lastShutdown: ShutdownDrainOutcome | null;
}

export interface ShutdownDrainOutcome {
  service: string;
  drained: number;
  lost: number;
  persisted: number;
  flushTimedOut: boolean;
  startedAt: string;
  finishedAt: string;
}
