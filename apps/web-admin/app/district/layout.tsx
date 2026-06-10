import type { ReactNode } from "react";
import { ROLE_LABEL, requirePageRole } from "@aivo/admin-auth";
import { AdminShell } from "@/components/admin-shell";
import { DISTRICT_NAV_GROUPS } from "@/lib/admin-nav-model";

/** Every /district/* page renders inside the grouped app shell. */
export default async function DistrictLayout({ children }: { children: ReactNode }) {
  const session = await requirePageRole(["district_admin"]);
  return (
    <AdminShell
      groups={[...DISTRICT_NAV_GROUPS]}
      account={{ displayName: session.displayName, roleLabel: ROLE_LABEL[session.role] }}
      homeHref="/district"
      homeLabel="District"
      brand="AIVO District"
    >
      {children}
    </AdminShell>
  );
}
