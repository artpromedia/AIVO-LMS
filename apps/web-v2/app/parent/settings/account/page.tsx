import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { getStore } from "@/lib/db/store";
import { AccountForm } from "./account-form";

export default async function Page() {
  const session = await requirePageRole(["parent"]);
  const user = getStore().users.get(session.userId);

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Settings"
        title="Account"
        description="Update how your name appears across AIVO."
      />
      <Card className="max-w-lg p-6">
        <p className="mb-4 text-sm text-aivo-ink-soft">
          Signed in as <span className="font-medium">{session.email}</span>.
        </p>
        <AccountForm initial={{ displayName: user?.displayName ?? session.displayName }} />
      </Card>
    </AppShell>
  );
}
