import "server-only";

import { adminGet } from "./client";
import type { SessionProfile } from "@aivo/admin-auth/types";

/**
 * Read-only admin-api surface for the content-pack CMS.
 *
 * Wraps services/admin-svc/src/routes/content-cms.ts:
 *   - GET /api/admin/content-cms/packs       -> { packs, count }
 *   - GET /api/admin/content-cms/packs/:id    -> pack record (404 when absent)
 *
 * A content pack is a sealed, versioned bundle of authored activities for a
 * (subject, gradeBand) slice; admin-svc returns PackSummary rows for the list
 * and a full PackRecord for the detail.
 */

export type AdminContentPackStatus = "draft" | "published";

export interface AdminContentValidation {
  ok: boolean;
  issueCount: number;
  validatedAt: string | null;
}

export interface AdminContentPackSummary {
  id: string;
  title: string;
  version: string;
  subject: string;
  gradeBand: string;
  status: AdminContentPackStatus;
  updatedAt: string;
  validation: AdminContentValidation | null;
}

export interface AdminContentPackDetail extends AdminContentPackSummary {
  activityCount: number;
}

function normalizeStatus(value: unknown): AdminContentPackStatus {
  return String(value ?? "draft") === "published" ? "published" : "draft";
}

function mapValidation(value: unknown): AdminContentValidation | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  return {
    ok: Boolean(row.ok),
    issueCount: Number(row.issueCount ?? 0),
    validatedAt: row.validatedAt ? String(row.validatedAt) : null,
  };
}

function mapPackSummary(row: Record<string, unknown>): AdminContentPackSummary {
  return {
    id: String(row.id),
    title: String(row.title ?? row.id),
    version: String(row.version ?? "0.0.0"),
    subject: String(row.subject ?? "unknown"),
    gradeBand: String(row.gradeBand ?? "—"),
    status: normalizeStatus(row.status),
    updatedAt: String(row.updatedAt ?? new Date(0).toISOString()),
    validation: mapValidation(row.lastValidation),
  };
}

export async function listContentPacks(
  session: Pick<SessionProfile, "role">,
): Promise<AdminContentPackSummary[]> {
  const payload = await adminGet<Record<string, unknown>>(
    session,
    "/api/admin/content-cms/packs",
  );
  const packs = Array.isArray(payload.packs) ? payload.packs : [];
  return packs.map((pack) => mapPackSummary(pack as Record<string, unknown>));
}

export async function getContentPack(
  session: Pick<SessionProfile, "role">,
  packId: string,
): Promise<AdminContentPackDetail> {
  const row = await adminGet<Record<string, unknown>>(
    session,
    `/api/admin/content-cms/packs/${encodeURIComponent(packId)}`,
  );
  const pack =
    row.pack && typeof row.pack === "object" ? (row.pack as Record<string, unknown>) : {};
  const activities = Array.isArray(pack.activities) ? pack.activities : [];
  return {
    ...mapPackSummary(row),
    activityCount: activities.length,
  };
}
