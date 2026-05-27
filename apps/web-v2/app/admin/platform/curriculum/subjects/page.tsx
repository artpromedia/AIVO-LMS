import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { listDomains, listSkills, listSubjects } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const subjects = await listSubjects();
  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Curriculum"
        title="Subjects and domains"
        description="Top-level subjects grouped by domain. Each skill belongs to one subject."
      />
      <div className="grid gap-3 md:grid-cols-2">
        {await Promise.all(
          subjects.map(async (s) => {
            const doms = listDomains(s.id);
            const sks = await listSkills(s.id);
          return (
            <Card key={s.id} className="p-[var(--aivo-density-card-pad)]">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-semibold">{s.name}</h2>
                <Badge tone="neutral">{sks.length} skills</Badge>
              </div>
              <p className="text-xs text-aivo-muted mt-1">{s.description}</p>
              <ul className="mt-3 space-y-1 text-sm">
                {doms.length === 0 ? (
                  <li className="text-aivo-muted">No domains yet.</li>
                ) : (
                  doms.map((d) => (
                    <li key={d.id} className="flex items-start justify-between gap-2">
                      <span>{d.name}</span>
                      <span className="text-xs text-aivo-muted">{d.description}</span>
                    </li>
                  ))
                )}
              </ul>
            </Card>
          );
          }),
        )}
      </div>
    </AppShell>
  );
}
