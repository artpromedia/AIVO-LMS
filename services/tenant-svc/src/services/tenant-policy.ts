import {
  canReadParentPrivateNotes,
  canViewDistrictAnalytics,
  canMutateBrainGovernanceFields,
} from "@aivo/enterprise-core";
import type { TenantRole } from "@aivo/enterprise-core";

export interface TenantPolicyDecision {
  allowed: boolean;
  reason: string;
}

export function decideRosterAccess(role: TenantRole | undefined): TenantPolicyDecision {
  if (!role) return { allowed: false, reason: "missing_role" };
  switch (role) {
    case "school_admin":
    case "district_admin":
    case "platform_admin":
    case "service":
      return { allowed: true, reason: "ok" };
    default:
      return { allowed: false, reason: `role_${role}_cannot_access_roster` };
  }
}

export function decideDistrictAnalyticsAccess(role: TenantRole | undefined): TenantPolicyDecision {
  if (canViewDistrictAnalytics(role)) {
    return { allowed: true, reason: "ok" };
  }
  return { allowed: false, reason: `role_${role ?? "none"}_cannot_view_district_analytics` };
}

export function decideParentPrivateNoteAccess(role: TenantRole | undefined): TenantPolicyDecision {
  if (canReadParentPrivateNotes(role)) {
    return { allowed: true, reason: "ok" };
  }
  return { allowed: false, reason: `role_${role ?? "none"}_cannot_read_parent_private_notes` };
}

export function decideBrainMutationAccess(role: TenantRole | undefined): TenantPolicyDecision {
  if (canMutateBrainGovernanceFields(role)) {
    return { allowed: true, reason: "ok" };
  }
  return { allowed: false, reason: `role_${role ?? "none"}_cannot_mutate_brain` };
}
