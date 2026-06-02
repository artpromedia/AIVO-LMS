/**
 * Data-portability export orchestrator (GDPR Art. 20, Sprint 5).
 *
 * Fans `subject.export.requested` out to every subscriber's
 * `POST /__governance/export`, collects each service's structured JSON
 * payload, and assembles a single portable bundle with a manifest. The
 * bundle is machine-readable, structured JSON — the format the privacy DoD
 * check validates.
 *
 * The dispatcher is injected for unit testing.
 */
import {
  governanceSubscribers,
  httpGovernanceFetch,
  type GovernanceFetch,
  type Subscriber,
  type SubscriberResult,
} from "./subscribers.js";

export interface ExportRequest {
  subjectId: string;
  subjectType?: string;
  tenantId?: string | null;
  subjectEmail?: string | null;
  dsarId?: string;
}

export interface ExportManifest {
  format: "json";
  schemaVersion: string;
  generatedAt: string;
  subjectId: string;
  subjectType: string;
  /** GDPR Article this export satisfies. */
  regulation: "GDPR Art. 20";
  services: string[];
  recordCounts: Record<string, number>;
  failedServices: string[];
}

export interface ExportBundle {
  manifest: ExportManifest;
  /** service name -> that service's structured JSON payload. */
  data: Record<string, unknown>;
}

export const EXPORT_SCHEMA_VERSION = "1.0";

/** Assemble subscriber results into a portable, Art. 20-shaped bundle. */
export function assembleExportBundle(
  req: ExportRequest,
  results: SubscriberResult[],
  now: Date = new Date(),
): ExportBundle {
  const data: Record<string, unknown> = {};
  const recordCounts: Record<string, number> = {};
  const services: string[] = [];
  const failedServices: string[] = [];

  for (const r of results.slice().sort((a, b) => a.service.localeCompare(b.service))) {
    if (r.ok) {
      data[r.service] = r.bundle ?? {};
      services.push(r.service);
      recordCounts[r.service] = Object.values(r.counts).reduce((s, n) => s + n, 0);
    } else {
      failedServices.push(r.service);
    }
  }

  return {
    manifest: {
      format: "json",
      schemaVersion: EXPORT_SCHEMA_VERSION,
      generatedAt: now.toISOString(),
      subjectId: req.subjectId,
      subjectType: req.subjectType ?? "learner",
      regulation: "GDPR Art. 20",
      services,
      recordCounts,
      failedServices,
    },
    data,
  };
}

export interface Art20Validation {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a bundle against the GDPR Art. 20 portability format checks:
 * machine-readable (JSON-serializable), structured (manifest + data), and
 * carrying the provenance fields a data subject needs. Used by the privacy
 * DoD test and before handing a bundle to a requester.
 */
export function validateArt20Bundle(bundle: unknown): Art20Validation {
  const errors: string[] = [];
  const b = bundle as Partial<ExportBundle> | null;
  if (!b || typeof b !== "object") {
    return { valid: false, errors: ["bundle is not an object"] };
  }
  const m = b.manifest;
  if (!m || typeof m !== "object") {
    errors.push("missing manifest");
  } else {
    if (m.format !== "json") errors.push("manifest.format must be 'json'");
    if (!m.generatedAt || Number.isNaN(Date.parse(m.generatedAt)))
      errors.push("manifest.generatedAt must be an ISO timestamp");
    if (!m.subjectId) errors.push("manifest.subjectId is required");
    if (!Array.isArray(m.services)) errors.push("manifest.services must be an array");
    if (!m.regulation) errors.push("manifest.regulation is required");
  }
  if (!b.data || typeof b.data !== "object") {
    errors.push("missing data object");
  }
  // Machine-readable: must round-trip through JSON without throwing.
  try {
    JSON.parse(JSON.stringify(bundle));
  } catch {
    errors.push("bundle is not JSON-serializable");
  }
  return { valid: errors.length === 0, errors };
}

export async function runExportFanout(
  req: ExportRequest,
  opts: { subscribers?: Subscriber[]; fetchImpl?: GovernanceFetch; now?: Date } = {},
): Promise<ExportBundle> {
  const subscribers = opts.subscribers ?? governanceSubscribers();
  const fetchImpl = opts.fetchImpl ?? httpGovernanceFetch;
  const body = {
    subjectId: req.subjectId,
    subjectType: req.subjectType ?? "learner",
    tenantId: req.tenantId ?? null,
    dsarId: req.dsarId ?? null,
  };
  const results = await Promise.all(
    subscribers.map((s) => fetchImpl(s, "/__governance/export", body)),
  );
  return assembleExportBundle(req, results, opts.now);
}
