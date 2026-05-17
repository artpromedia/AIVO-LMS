import { promises as fs } from "node:fs";
import { dirname } from "node:path";
import type { OpsAlertEnvelope, OpsAlertOutboxStore } from "../types.js";

export class FileOpsAlertOutboxStore implements OpsAlertOutboxStore {
  readonly kind = "file" as const;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly path: string) {}

  private serialize(envelope: OpsAlertEnvelope): string {
    return JSON.stringify(envelope) + "\n";
  }

  private async readAll(): Promise<OpsAlertEnvelope[]> {
    try {
      const raw = await fs.readFile(this.path, "utf8");
      return raw
        .split("\n")
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as OpsAlertEnvelope);
    } catch (err: any) {
      if (err.code === "ENOENT") return [];
      throw err;
    }
  }

  private async writeAll(envelopes: OpsAlertEnvelope[]): Promise<void> {
    await fs.mkdir(dirname(this.path), { recursive: true });
    if (envelopes.length === 0) {
      await fs.writeFile(this.path, "");
      return;
    }
    await fs.writeFile(this.path, envelopes.map((e) => this.serialize(e)).join(""));
  }

  async enqueue(envelope: OpsAlertEnvelope): Promise<void> {
    this.writeChain = this.writeChain.then(async () => {
      await fs.mkdir(dirname(this.path), { recursive: true });
      await fs.appendFile(this.path, this.serialize(envelope));
    });
    await this.writeChain;
  }

  async drain(handler: (envelope: OpsAlertEnvelope) => Promise<void>) {
    const envelopes = await this.readAll();
    let drained = 0;
    const remaining = [...envelopes];
    for (const envelope of envelopes) {
      try {
        await handler(envelope);
        remaining.shift();
        drained++;
      } catch (err) {
        await this.writeAll(remaining);
        return { drained, remaining: remaining.length };
      }
    }
    await this.writeAll(remaining);
    return { drained, remaining: remaining.length };
  }

  async size(): Promise<number> {
    const envelopes = await this.readAll();
    return envelopes.length;
  }
}
