import type { OpsAlertEnvelope, OpsAlertOutboxStore } from "../types.js";

export class MemoryOpsAlertOutboxStore implements OpsAlertOutboxStore {
  readonly kind = "memory" as const;
  private queue: OpsAlertEnvelope[] = [];

  async enqueue(envelope: OpsAlertEnvelope): Promise<void> {
    this.queue.push(envelope);
  }

  async drain(handler: (envelope: OpsAlertEnvelope) => Promise<void>) {
    let drained = 0;
    while (this.queue.length > 0) {
      const next = this.queue[0]!;
      await handler(next);
      this.queue.shift();
      drained++;
    }
    return { drained, remaining: this.queue.length };
  }

  async size(): Promise<number> {
    return this.queue.length;
  }
}
