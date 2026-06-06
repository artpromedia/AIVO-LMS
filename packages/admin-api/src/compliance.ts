import "server-only";

import { adminGet } from "./client";
import type { SessionProfile } from "@aivo/admin-auth/types";

export type AdminControlStatus = "pass" | "warn" | "fail" | "unknown";

export interface AdminComplianceControl {
  id: string;
  label: string;
  category: string;
  status: AdminControlStatus;
  evidence: string;
  runbook: string | null;
  lastCheckedAt: string;
}

export interface AdminEvidenceBundle {
  id: string;
  bundleDate: string;
  filename: string;
  sizeBytes: number;
  sha256: string;
  generatedAt: string;
}

function normalizeStatus(value: unknown): AdminControlStatus {
  const status = String(value ?? "unknown");
  if (status === "pass" || status === "warn" || status === "fail") return status;
  return "unknown";
}

export async function listComplianceControls(
  session: Pick<SessionProfile, "role">,
): Promise<AdminComplianceControl[]> {
  const payload = await adminGet<Record<string, unknown>>(
    session,
    "/api/admin-svc/compliance/controls",
  );
  const controls = Array.isArray(payload.controls) ? payload.controls : [];
  return controls.map((control) => {
    const row = control as Record<string, unknown>;
    return {
      id: String(row.id),
      label: String(row.label ?? row.id),
      category: String(row.category ?? "Unknown"),
      status: normalizeStatus(row.status),
      evidence: String(row.evidence ?? ""),
      runbook: row.runbook ? String(row.runbook) : null,
      lastCheckedAt: String(row.lastCheckedAt ?? payload.generatedAt ?? new Date(0).toISOString()),
    };
  });
}

export async function listEvidenceBundles(
  session: Pick<SessionProfile, "role">,
): Promise<AdminEvidenceBundle[]> {
  const payload = await adminGet<Record<string, unknown>>(
    session,
    "/api/admin-svc/compliance/evidence",
  );
  const bundles = Array.isArray(payload.bundles) ? payload.bundles : [];
  return bundles.map((bundle) => {
    const row = bundle as Record<string, unknown>;
    return {
      id: String(row.id),
      bundleDate: String(row.bundleDate ?? ""),
      filename: String(row.filename ?? ""),
      sizeBytes: Number(row.sizeBytes ?? 0),
      sha256: String(row.sha256 ?? ""),
      generatedAt: String(row.generatedAt ?? new Date(0).toISOString()),
    };
  });
}
