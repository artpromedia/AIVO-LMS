import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { TEACHER_NAV } from "@/components/layout/role-shells";
import { AccountForm } from "@/app/parent/settings/account/account-form";

export default async function Page() {
  const session = await requirePageRole(["teacher"]);
  return (
    <AppShell
      role="teacher"
      roleLabel="Teacher"
      navItems={TEACHER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Settings"
        title="Settings"
        description="Profile and classroom defaults."
      />
      <Card className="max-w-lg p-6">
        <p className="mb-4 text-sm text-aivo-ink-soft">
          Signed in as <span className="font-medium">{session.email}</span>.
        </p>
        <AccountForm initial={{ displayName: session.displayName }} />
      </Card>
    </AppShell>
  );
}
