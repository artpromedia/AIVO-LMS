import "server-only";

import { adminGet } from "./client";
import {
  type AdminBillingAccount,
  adminTenantTypeLabel,
  normalizeBillingStatus,
  normalizeTenantKind,
} from "./types";
import type { SessionProfile } from "@aivo/admin-auth/types";

export async function listBillingAccounts(
  session: Pick<SessionProfile, "role">,
): Promise<AdminBillingAccount[]> {
  const payload = await adminGet<Record<string, unknown>>(session, "/api/admin-svc/billing/accounts");
  const accounts = Array.isArray(payload.accounts) ? payload.accounts : [];
  return accounts.map((row) => ({
    id: String((row as Record<string, unknown>).id),
    tenantId: String((row as Record<string, unknown>).tenantId),
    tenantName: (row as Record<string, unknown>).tenantName
      ? String((row as Record<string, unknown>).tenantName)
      : null,
    tenantType: (row as Record<string, unknown>).tenantType
      ? String((row as Record<string, unknown>).tenantType)
      : null,
    tenantKind: normalizeTenantKind((row as Record<string, unknown>).tenantType as string | undefined),
    tenantTypeLabel: adminTenantTypeLabel(
      (row as Record<string, unknown>).tenantType as string | undefined,
    ),
    plan: String((row as Record<string, unknown>).plan ?? "unknown"),
    status: normalizeBillingStatus((row as Record<string, unknown>).status as string | undefined),
    createdAt: String((row as Record<string, unknown>).createdAt ?? new Date(0).toISOString()),
    updatedAt: (row as Record<string, unknown>).updatedAt
      ? String((row as Record<string, unknown>).updatedAt)
      : null,
    currentPeriodEnd: (row as Record<string, unknown>).currentPeriodEnd
      ? String((row as Record<string, unknown>).currentPeriodEnd)
      : null,
    paymentStatus: (row as Record<string, unknown>).paymentStatus
      ? String((row as Record<string, unknown>).paymentStatus)
      : null,
  }));
}
