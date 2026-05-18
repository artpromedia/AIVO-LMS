import { createLogger } from "@aivo/observability";
import type { OpsAlertOutboxStore } from "../types.js";
import { MemoryOpsAlertOutboxStore } from "./memory.js";
import { FileOpsAlertOutboxStore } from "./file.js";
import { PostgresOpsAlertOutboxStore, type PgOutboxClient } from "./postgres.js";

const logger = createLogger("ops-alerts:outbox");

export interface OutboxFromEnvOptions {
  service: string;
  pgOutboxClient?: () => PgOutboxClient | Promise<PgOutboxClient>;
  /** When true, missing PG client with PG_TABLE set throws instead of warning. */
  strict?: boolean;
  env?: NodeJS.ProcessEnv;
}

export interface OutboxFromEnvResult {
  store: OpsAlertOutboxStore;
  pgRequestedButUnwired: boolean;
}

export async function opsAlertOutboxStoreFromEnv(
  opts: OutboxFromEnvOptions,
): Promise<OutboxFromEnvResult> {
  const env = opts.env ?? process.env;
  const pgTable = env.OPS_ALERTS_OUTBOX_PG_TABLE;
  const filePath = env.OPS_ALERTS_OUTBOX_FILE_PATH;

  if (pgTable && opts.pgOutboxClient) {
    const client = await opts.pgOutboxClient();
    return {
      store: new PostgresOpsAlertOutboxStore({ table: pgTable, client }),
      pgRequestedButUnwired: false,
    };
  }

  if (pgTable && !opts.pgOutboxClient) {
    const detail = {
      service: opts.service,
      table: pgTable,
      fallbackKind: filePath ? "file" : "memory",
    };
    if (opts.strict || env.OPS_ALERTS_OUTBOX_PG_STRICT === "1") {
      throw new Error(
        `ops-alerts: OPS_ALERTS_OUTBOX_PG_TABLE is set (${pgTable}) but no pgOutboxClient was provided. ` +
          `Refusing to silently fall back to ${detail.fallbackKind} store.`,
      );
    }
    logger.warn(
      "ops_alerts.outbox.pg_misconfigured: OPS_ALERTS_OUTBOX_PG_TABLE is set but pgOutboxClient is missing; falling back to non-durable store",
      detail,
    );
  }

  if (filePath) {
    return {
      store: new FileOpsAlertOutboxStore(filePath),
      pgRequestedButUnwired: Boolean(pgTable && !opts.pgOutboxClient),
    };
  }

  return {
    store: new MemoryOpsAlertOutboxStore(),
    pgRequestedButUnwired: Boolean(pgTable && !opts.pgOutboxClient),
  };
}
