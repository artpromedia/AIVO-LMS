import "server-only";

import { adminGet } from "./client";
import type { SessionProfile } from "@aivo/admin-auth/types";

/**
 * Read-only admin-api surface for the feature-flag inventory.
 *
 * Wraps admin-svc GET /api/admin-svc/feature-flags, which resolves the
 * enterprise flags (from @aivo/feature-flags metadata) and sprint-pipeline
 * product flags against the deployment's environment. Env vars remain the
 * source of truth; this surface is read-only.
 */

export type AdminFlagRiskBand = "low" | "medium" | "high";
export type AdminFlagSurface = "ai" | "enterprise" | "integrations" | "ux";

export interface AdminFeatureFlag {
  key: string;
  label: string;
  description: string;
  surface: AdminFlagSurface;
  riskBand: AdminFlagRiskBand;
  defaultValue: boolean;
  active: boolean;
  /** Present for sprint-pipeline flags whose state is a single env var. */
  envVar: string | null;
}

export interface AdminFeatureFlagInventory {
  enterprise: AdminFeatureFlag[];
  sprintPipeline: AdminFeatureFlag[];
}

function normalizeSurface(value: unknown): AdminFlagSurface {
  const surface = String(value ?? "enterprise");
  return surface === "ai" || surface === "integrations" || surface === "ux"
    ? surface
    : "enterprise";
}

function normalizeRisk(value: unknown): AdminFlagRiskBand {
  const risk = String(value ?? "low");
  return risk === "medium" || risk === "high" ? risk : "low";
}

function mapFlag(row: Record<string, unknown>): AdminFeatureFlag {
  return {
    key: String(row.key ?? ""),
    label: String(row.label ?? row.key ?? "unknown"),
    description: String(row.description ?? ""),
    surface: normalizeSurface(row.surface),
    riskBand: normalizeRisk(row.riskBand),
    defaultValue: Boolean(row.defaultValue),
    active: Boolean(row.active),
    envVar: row.envVar ? String(row.envVar) : null,
  };
}

function mapList(value: unknown): AdminFeatureFlag[] {
  return Array.isArray(value) ? value.map((row) => mapFlag(row as Record<string, unknown>)) : [];
}

export async function getFeatureFlagInventory(
  session: Pick<SessionProfile, "role">,
): Promise<AdminFeatureFlagInventory> {
  const payload = await adminGet<Record<string, unknown>>(session, "/api/admin-svc/feature-flags");
  const flags =
    payload.flags && typeof payload.flags === "object"
      ? (payload.flags as Record<string, unknown>)
      : {};
  return {
    enterprise: mapList(flags.enterprise),
    sprintPipeline: mapList(flags.sprintPipeline),
  };
}
