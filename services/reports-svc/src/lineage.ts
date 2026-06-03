/**
 * Run lineage (Sprint 10).
 *
 * Every report run records where its data came from: the report id + version,
 * the resolved parameters, and each upstream source (service + query +
 * queryVersion). Lineage makes results auditable and reproducible — given a
 * run's lineage you can re-derive exactly which service queries produced it.
 */
import { createHash } from "node:crypto";
import type { ReportDefinition, ReportSource } from "./registry/types.js";

export interface RunLineage {
  reportId: string;
  /** Stable hash of the report definition's columns + param names. */
  reportVersion: string;
  params: Record<string, unknown>;
  sources: ReportSource[];
  capturedAt: string;
}

export function reportVersion(def: ReportDefinition): string {
  const shape = JSON.stringify({
    columns: def.columns.map((c) => [c.key, c.type]),
    params: def.params.map((p) => [p.name, p.type]),
  });
  return createHash("sha256").update(shape).digest("hex").slice(0, 12);
}

export function captureLineage(
  def: ReportDefinition,
  params: Record<string, unknown>,
  sources: ReportSource[],
): RunLineage {
  return {
    reportId: def.id,
    reportVersion: reportVersion(def),
    params,
    sources,
    capturedAt: new Date().toISOString(),
  };
}
