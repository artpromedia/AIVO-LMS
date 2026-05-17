import type { OpsAlertEnvelope, OpsAlertOutboxStore } from "../types.js";

export interface PgOutboxClient {
  query<R = unknown>(sql: string, params?: unknown[]): Promise<{ rows: R[]; rowCount: number }>;
}

export interface PgOutboxOptions {
  table: string;
  client: PgOutboxClient;
}

export class PostgresOpsAlertOutboxStore implements OpsAlertOutboxStore {
  readonly kind = "postgres" as const;
  private readonly table: string;
  private readonly client: PgOutboxClient;

  constructor(options: PgOutboxOptions) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(options.table)) {
      throw new Error(`PostgresOpsAlertOutboxStore: unsafe table name: ${options.table}`);
    }
    this.table = options.table;
    this.client = options.client;
  }

  async enqueue(envelope: OpsAlertEnvelope): Promise<void> {
    await this.client.query(
      `INSERT INTO ${this.table} (id, service, severity, payload, occurred_at, attempt)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [
        envelope.id,
        envelope.service,
        envelope.severity,
        JSON.stringify(envelope),
        envelope.occurredAt,
        envelope.attempt,
      ],
    );
  }

  async drain(handler: (envelope: OpsAlertEnvelope) => Promise<void>) {
    const { rows } = await this.client.query<{ id: string; payload: string }>(
      `SELECT id, payload FROM ${this.table} ORDER BY occurred_at ASC LIMIT 500`,
    );
    let drained = 0;
    for (const row of rows) {
      const envelope =
        typeof row.payload === "string" ? (JSON.parse(row.payload) as OpsAlertEnvelope) : (row.payload as OpsAlertEnvelope);
      try {
        await handler(envelope);
        await this.client.query(`DELETE FROM ${this.table} WHERE id = $1`, [row.id]);
        drained++;
      } catch {
        break;
      }
    }
    const { rows: remainingRows } = await this.client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM ${this.table}`,
    );
    return { drained, remaining: parseInt(remainingRows[0]?.count ?? "0", 10) };
  }

  async size(): Promise<number> {
    const { rows } = await this.client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM ${this.table}`,
    );
    return parseInt(rows[0]?.count ?? "0", 10);
  }
}
