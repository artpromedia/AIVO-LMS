import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { listStandardDocuments, listStandards, listStandardsFrameworks } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const frameworks = listStandardsFrameworks();
  const docs = listStandardDocuments();
  const standards = listStandards();
  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Curriculum"
        title="Standards frameworks"
        description="Public and AIVO-defined standards frameworks the skill graph aligns to."
      />
      <div className="space-y-3">
        {frameworks.map((f) => {
          const fdocs = docs.filter((d) => d.frameworkId === f.id);
          const fstds = standards.filter((s) => s.frameworkId === f.id);
          return (
            <Card key={f.id} className="p-[var(--aivo-density-card-pad)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display font-semibold">{f.name}</h2>
                  <p className="text-xs text-aivo-muted">
                    {f.issuer} · slug: <code className="text-[11px]">{f.slug}</code>
                  </p>
                  <p className="mt-1 text-sm">{f.description}</p>
                </div>
                <Badge tone={f.status === "active" ? "success" : "neutral"}>{f.status}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <Badge tone="neutral">{fdocs.length} docs</Badge>
                <Badge tone="neutral">{fstds.length} standards</Badge>
                {f.homepageUrl && (
                  <a
                    className="text-aivo-primary underline"
                    href={f.homepageUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Homepage →
                  </a>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
