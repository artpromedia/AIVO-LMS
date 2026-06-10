/**
 * Grouped information architecture for the platform console sidebar.
 *
 * Pure data: the server layout filters it by the session role and hands the
 * result to the client shell, so role logic never ships to the browser.
 * Role visibility mirrors the pre-shell gating: pilot/coupon destinations
 * were platform-admin actions, sales leads were platform_admin + sales, and
 * everything else is visible to any platform-staff role.
 */
import type { Role } from "@aivo/admin-auth/types";

export interface AdminNavItem {
  label: string;
  href: string;
  /** Roles that may see this item; omitted = every platform role. */
  roles?: readonly Role[];
}

export interface AdminNavGroup {
  /** Stable id used for data-testids and collapse state. */
  id: string;
  label: string;
  items: AdminNavItem[];
}

export const PLATFORM_NAV_GROUPS: readonly AdminNavGroup[] = [
  {
    id: "identity-access",
    label: "Identity & Access",
    items: [
      { label: "Tenants", href: "/platform/tenants" },
      { label: "Users", href: "/platform/users" },
      { label: "Learners", href: "/platform/learners" },
      { label: "Identity", href: "/platform/identity" },
      { label: "API keys", href: "/platform/settings/api-keys" },
    ],
  },
  {
    id: "ai-governance",
    label: "AI Governance",
    items: [
      { label: "Models", href: "/platform/ai/models" },
      { label: "Policies", href: "/platform/ai/policies" },
      { label: "Incidents", href: "/platform/ai/incidents" },
      { label: "Evals", href: "/platform/ai/evals" },
      { label: "Opt-outs", href: "/platform/ai/optouts" },
      { label: "AI costs", href: "/platform/ai-costs" },
      { label: "Safety", href: "/platform/safety" },
    ],
  },
  {
    id: "billing-growth",
    label: "Billing & Growth",
    items: [
      { label: "Billing", href: "/platform/billing" },
      { label: "Pilots", href: "/platform/pilots", roles: ["platform_admin"] },
      { label: "Coupons", href: "/platform/billing/coupons", roles: ["platform_admin"] },
      { label: "Sales leads", href: "/platform/sales/leads", roles: ["platform_admin", "sales"] },
    ],
  },
  {
    id: "compliance-trust",
    label: "Compliance & Trust",
    items: [
      { label: "Compliance", href: "/platform/compliance" },
      { label: "Security", href: "/platform/security" },
      { label: "Audit log", href: "/platform/audit" },
      { label: "IEP oversight", href: "/platform/iep" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      { label: "System health", href: "/platform/system-health" },
      { label: "Jobs", href: "/platform/jobs" },
      { label: "Feature flags", href: "/platform/feature-flags" },
      { label: "Support", href: "/platform/support" },
      { label: "Content", href: "/platform/content" },
      { label: "Pronunciation", href: "/platform/audio/pronunciation" },
      { label: "Baseline items", href: "/platform/baseline-items" },
    ],
  },
];

/** Groups visible to a role, with role-gated items removed (empty groups drop). */
export function navGroupsForRole(role: Role): AdminNavGroup[] {
  return PLATFORM_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.roles || item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);
}
