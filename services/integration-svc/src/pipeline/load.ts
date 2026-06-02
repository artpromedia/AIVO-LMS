/**
 * Sprint 2 — load stage. Concrete {@link RosterWriter} implementations that
 * persist a computed diff into AIVO.
 *
 * `HttpRosterWriter` POSTs canonical upserts / soft-deletes to identity-svc
 * (users) and tenant-svc (orgs/classes/enrollments/courses/terms) over the
 * internal service-to-service API, authenticated with a service JWT. `fetch`
 * is injectable so the routing logic is unit-testable without live services.
 *
 * The writer never hard-deletes — `softDelete` maps to the services'
 * deactivate endpoints with an effective date, honoring the sprint's
 * soft-delete-only rule.
 */
import type { EntityKind } from "../types/canonical.js";
import type { RosterWriter } from "./apply.js";

export interface HttpRosterWriterConfig {
  identitySvcUrl: string;
  tenantSvcUrl: string;
  /** Service-to-service bearer (svc:* scoped JWT). */
  serviceToken: string;
  tenantId: string;
  provider: string;
}

type FetchFn = typeof fetch;

/** Which service owns each entity kind. */
function serviceFor(kind: EntityKind): "identity" | "tenant" {
  return kind === "users" ? "identity" : "tenant";
}

export class HttpRosterWriter implements RosterWriter {
  constructor(
    private readonly cfg: HttpRosterWriterConfig,
    private readonly fetchImpl: FetchFn = fetch,
  ) {}

  private baseFor(kind: EntityKind): string {
    return serviceFor(kind) === "identity"
      ? this.cfg.identitySvcUrl.replace(/\/$/, "")
      : this.cfg.tenantSvcUrl.replace(/\/$/, "");
  }

  private headers(): Record<string, string> {
    return {
      authorization: `Bearer ${this.cfg.serviceToken}`,
      "content-type": "application/json",
      "x-tenant-id": this.cfg.tenantId,
      "x-roster-provider": this.cfg.provider,
    };
  }

  async upsert(kind: EntityKind, record: { sourcedId: string }): Promise<void> {
    const url = `${this.baseFor(kind)}/internal/roster/${kind}/upsert`;
    const res = await this.fetchImpl(url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ tenantId: this.cfg.tenantId, provider: this.cfg.provider, record }),
    });
    if (!res.ok) throw new Error(`roster upsert ${kind}/${record.sourcedId} failed: ${res.status}`);
  }

  async softDelete(
    kind: EntityKind,
    record: { sourcedId: string },
    effectiveDate: string,
  ): Promise<void> {
    const url = `${this.baseFor(kind)}/internal/roster/${kind}/deactivate`;
    const res = await this.fetchImpl(url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        tenantId: this.cfg.tenantId,
        provider: this.cfg.provider,
        sourcedId: record.sourcedId,
        effectiveDate,
      }),
    });
    if (!res.ok) {
      throw new Error(`roster deactivate ${kind}/${record.sourcedId} failed: ${res.status}`);
    }
  }
}

/**
 * Capturing writer for dry-runs and tests — records the operations that
 * would be performed without making any network calls.
 */
export class RecordingRosterWriter implements RosterWriter {
  readonly ops: Array<{ op: "upsert" | "softDelete"; kind: EntityKind; sourcedId: string }> = [];
  async upsert(kind: EntityKind, record: { sourcedId: string }): Promise<void> {
    this.ops.push({ op: "upsert", kind, sourcedId: record.sourcedId });
  }
  async softDelete(kind: EntityKind, record: { sourcedId: string }): Promise<void> {
    this.ops.push({ op: "softDelete", kind, sourcedId: record.sourcedId });
  }
}
