import type { ReactNode } from "react";
import { ROLE_LABEL, requirePlatformPage } from "@aivo/admin-auth";
import { AdminShell } from "@/components/admin-shell";
import { navGroupsForRole } from "@/lib/admin-nav-model";

/**
 * Every /platform/* page renders inside the grouped app shell. The session
 * is read here so the nav model is role-filtered server-side; pages keep
 * their own (equal or stricter) auth checks.
 */
export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const session = await requirePlatformPage("platform:read");
  return (
    <AdminShell
      groups={navGroupsForRole(session.role)}
      account={{ displayName: session.displayName, roleLabel: ROLE_LABEL[session.role] }}
    >
      {children}
    </AdminShell>
  );
}
