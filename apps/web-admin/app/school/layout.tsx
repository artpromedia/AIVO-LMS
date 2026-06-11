import type { ReactNode } from "react";
import { ROLE_LABEL, requirePageRole } from "@aivo/admin-auth";
import { AdminShell } from "@/components/admin-shell";
import { getTenantBrandingById } from "@/lib/tenant-branding";
import { SCHOOL_NAV_GROUPS } from "@/lib/admin-nav-model";

/** Every /school/* page renders inside the grouped app shell. */
export default async function SchoolLayout({ children }: { children: ReactNode }) {
  const session = await requirePageRole(["school_admin", "district_admin", "platform_admin"]);
  const branding = await getTenantBrandingById(session.tenantId);
  return (
    <AdminShell
      tenantLogoUrl={branding?.logoUrl ?? null}
      groups={[...SCHOOL_NAV_GROUPS]}
      account={{ displayName: session.displayName, roleLabel: ROLE_LABEL[session.role] }}
      homeHref="/school"
      homeLabel="School"
      brand="AIVO School"
    >
      {children}
    </AdminShell>
  );
}
