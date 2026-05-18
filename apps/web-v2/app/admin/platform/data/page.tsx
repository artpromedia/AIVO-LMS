import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { getStore } from "@/lib/db/store";

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const s = getStore();
  const rows = [
    { k: "Tenants", v: s.tenants.size },
    { k: "Users", v: s.users.size },
    { k: "Memberships", v: s.memberships.length },
    { k: "Learner profiles", v: s.learnerProfiles.size },
    { k: "Lesson runs", v: s.lessonRuns.size },
    { k: "Skill masteries", v: s.skillMasteries.length },
    { k: "AI generation jobs", v: s.aiGenerationJobs.size },
    { k: "Audit events", v: s.auditLogs.length },
    { k: "Billing accounts", v: s.billingAccounts.size },
    { k: "Support tickets", v: s.supportTickets.size },
  ];
  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Data"
        title="Data inventory"
        description="Counts across every table in the in-memory demo store."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <Card key={r.k} className="p-[var(--aivo-density-card-pad)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">{r.k}</p>
            <p className="mt-1 font-display text-3xl font-bold">{r.v.toLocaleString()}</p>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
