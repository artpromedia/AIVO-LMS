/**
 * Grouped information architecture for the platform console sidebar.
 *
 * Pure data: the server layout filters it by the session role and hands the
 * result to the client shell, so role logic never ships to the browser.
 * Role visibility mirrors the pre-shell gating: pilot/coupon destinations
 * were platform-admin actions, sales leads were platform_admin + sales, and
 * everything else is visible to any platform-staff role.
 *
 * `icon` is a stable string key (not a component) so groups stay serialisable
 * across the server→client boundary; the shell maps the key to a lucide icon.
 */
import type { Role } from "@aivo/admin-auth/types";

export interface AdminNavItem {
  label: string;
  href: string;
  /** lucide icon key resolved client-side in the shell. */
  icon?: string;
  /** Roles that may see this item; omitted = every platform role. */
  roles?: readonly Role[];
}

export interface AdminNavGroup {
  /** Stable id used for data-testids and collapse state. */
  id: string;
  label: string;
  /** lucide icon key for the group header. */
  icon?: string;
  items: AdminNavItem[];
}

export const PLATFORM_NAV_GROUPS: readonly AdminNavGroup[] = [
  {
    id: "identity-access",
    label: "Identity & Access",
    icon: "fingerprint",
    items: [
      { label: "Tenants", href: "/platform/tenants", icon: "building-2" },
      { label: "Users", href: "/platform/users", icon: "users" },
      { label: "Learners", href: "/platform/learners", icon: "graduation-cap" },
      { label: "Identity", href: "/platform/identity", icon: "scan-face" },
      { label: "API keys", href: "/platform/settings/api-keys", icon: "key-round" },
    ],
  },
  {
    id: "ai-governance",
    label: "AI Governance",
    icon: "sparkles",
    items: [
      { label: "Models", href: "/platform/ai/models", icon: "boxes" },
      { label: "Policies", href: "/platform/ai/policies", icon: "file-text" },
      { label: "Incidents", href: "/platform/ai/incidents", icon: "siren" },
      { label: "Evals", href: "/platform/ai/evals", icon: "flask-conical" },
      { label: "Opt-outs", href: "/platform/ai/optouts", icon: "user-minus" },
      { label: "AI costs", href: "/platform/ai-costs", icon: "dollar-sign" },
      { label: "Safety", href: "/platform/safety", icon: "shield-alert" },
    ],
  },
  {
    id: "billing-growth",
    label: "Billing & Growth",
    icon: "trending-up",
    items: [
      { label: "Billing", href: "/platform/billing", icon: "credit-card" },
      { label: "Pilots", href: "/platform/pilots", icon: "rocket", roles: ["platform_admin"] },
      {
        label: "Coupons",
        href: "/platform/billing/coupons",
        icon: "ticket",
        roles: ["platform_admin"],
      },
      {
        label: "Sales leads",
        href: "/platform/sales/leads",
        icon: "megaphone",
        roles: ["platform_admin", "sales"],
      },
    ],
  },
  {
    id: "compliance-trust",
    label: "Compliance & Trust",
    icon: "shield-check",
    items: [
      { label: "Compliance", href: "/platform/compliance", icon: "clipboard-check" },
      { label: "Security", href: "/platform/security", icon: "shield" },
      { label: "Audit log", href: "/platform/audit", icon: "scroll-text" },
      { label: "IEP oversight", href: "/platform/iep", icon: "file-check" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    icon: "settings",
    items: [
      { label: "System health", href: "/platform/system-health", icon: "activity" },
      { label: "Jobs", href: "/platform/jobs", icon: "list-checks" },
      { label: "Feature flags", href: "/platform/feature-flags", icon: "flag" },
      { label: "Support", href: "/platform/support", icon: "life-buoy" },
      { label: "Content", href: "/platform/content", icon: "layout-template" },
      { label: "Pronunciation", href: "/platform/audio/pronunciation", icon: "volume-2" },
      { label: "Baseline items", href: "/platform/baseline-items", icon: "list-tree" },
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

/** School console IA — single role (school_admin), so no per-item gating. */
export const SCHOOL_NAV_GROUPS: readonly AdminNavGroup[] = [
  {
    id: "school-operations",
    label: "Operations",
    icon: "settings",
    items: [
      { label: "Learners", href: "/school/learners", icon: "graduation-cap" },
      { label: "Classes", href: "/school/classes", icon: "users" },
      { label: "Rostering", href: "/school/rostering", icon: "upload" },
    ],
  },
  {
    id: "school-reports",
    label: "Reports",
    icon: "bar-chart-3",
    items: [{ label: "Reports", href: "/school/reports", icon: "bar-chart-3" }],
  },
  {
    id: "school-compliance",
    label: "Compliance",
    icon: "shield-check",
    items: [
      { label: "Compliance", href: "/school/compliance", icon: "clipboard-check" },
      { label: "Audit log", href: "/school/audit", icon: "scroll-text" },
    ],
  },
  {
    id: "school-billing",
    label: "Billing",
    icon: "trending-up",
    items: [{ label: "Billing", href: "/school/billing", icon: "credit-card" }],
  },
];

/** District console IA — single role (district_admin), so no per-item gating. */
export const DISTRICT_NAV_GROUPS: readonly AdminNavGroup[] = [
  {
    id: "district-operations",
    label: "Operations",
    icon: "settings",
    items: [
      { label: "Parents", href: "/district/parents", icon: "users" },
      { label: "SIS connectors", href: "/district/sis", icon: "plug" },
      { label: "Single sign-on", href: "/district/sso-config", icon: "key-round" },
      { label: "Branding", href: "/district/branding", icon: "palette" },
      { label: "IEP evaluations", href: "/district/iep", icon: "file-check" },
    ],
  },
  {
    id: "district-reports",
    label: "Reports",
    icon: "bar-chart-3",
    items: [{ label: "Reports", href: "/district/reports", icon: "bar-chart-3" }],
  },
  {
    id: "district-compliance",
    label: "Compliance",
    icon: "shield-check",
    items: [
      { label: "Compliance", href: "/district/compliance", icon: "clipboard-check" },
      { label: "Audit log", href: "/district/audit", icon: "scroll-text" },
    ],
  },
  {
    id: "district-billing",
    label: "Billing",
    icon: "trending-up",
    items: [{ label: "Billing", href: "/district/billing", icon: "credit-card" }],
  },
];
