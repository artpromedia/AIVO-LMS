/**
 * Report run queue (Sprint 10).
 *
 * Runs execute INLINE by default (fast on seeded data, no infra needed). When
 * `REDIS_URL` is set, runs are dispatched to BullMQ with one queue per format
 * (`reports:csv`, `reports:json`, `reports:parquet`, `reports:pdf`) so heavy
 * formats (PDF via Playwright, Parquet) get their own worker pods and
 * concurrency. Both paths call the same `executeRun`, so behaviour is
 * identical — only the execution location differs.
 */
import type { ReportFormat } from "../registry/types.js";
import { executeRun, prepareRun, type RunInput } from "./engine.js";

export const FORMAT_QUEUES: Record<ReportFormat, string> = {
  csv: "reports:csv",
  json: "reports:json",
  parquet: "reports:parquet",
  pdf: "reports:pdf",
};

let bullEnabled = false;
export function reportQueueMode(): "inline" | "bullmq" {
  return bullEnabled ? "bullmq" : "inline";
}

/**
 * Start per-format BullMQ workers when REDIS_URL is configured. No-op
 * otherwise. The worker resolves the report definition by id and calls
 * `executeRun`, mirroring the inline path.
 */
export async function startReportWorkers(
  resolveInput: (jobData: { runInput: RunInput }) => RunInput,
): Promise<{ mode: "inline" | "bullmq"; close: () => Promise<void> }> {
  if (!process.env.REDIS_URL) {
    return { mode: "inline", close: async () => {} };
  }
  try {
    // Variable specifiers keep bullmq + ioredis optional runtime deps so
    // reports-svc builds without them (they ship in the worker pod image).
    const bullmqModule = "bullmq";
    const ioredisModule = "ioredis";
    const { Queue, Worker } = (await import(bullmqModule)) as any;
    const IORedis = ((await import(ioredisModule)) as any).default;
    const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
    const workers = Object.values(FORMAT_QUEUES).map(
      (name) =>
        new Worker(
          name,
          async (job: { data: { runInput: RunInput } }) => {
            const input = resolveInput(job.data);
            const prepared = prepareRun(input);
            if (!prepared.ok) throw new Error(prepared.code);
            return executeRun(input, prepared);
          },
          { connection },
        ),
    );
    // Touch Queue so it's constructed (producers add jobs from the route in a
    // BullMQ deployment); kept here to anchor the per-format queue names.
    void new Queue(FORMAT_QUEUES.csv, { connection });
    bullEnabled = true;
    return {
      mode: "bullmq",
      close: async () => {
        await Promise.all(workers.map((w) => w.close()));
        await connection.quit();
      },
    };
  } catch {
    return { mode: "inline", close: async () => {} };
  }
}
