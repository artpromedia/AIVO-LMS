import { scopeTenantsForSession } from "@/lib/db/repos";
import type { SessionProfile } from "@/lib/auth/types";

/**
 * Resolve which tenant IDs a session is allowed to read/operate on in admin
 * BFFs. Centralized so every admin route shares the same RBAC and a future
 * change (e.g. district admins should not see other districts' families)
 * only has to land in one place.
 */
export function adminScopeForSession(session: SessionProfile): {
  tenantIds: string[];
  isPlatform: boolean;
} {
  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  return {
    tenantIds: tenants.map((t) => t.id),
    isPlatform: session.role === "platform_admin",
  };
}

export const ADMIN_ROLES = [
  "school_admin",
  "district_admin",
  "platform_admin",
] as const;
