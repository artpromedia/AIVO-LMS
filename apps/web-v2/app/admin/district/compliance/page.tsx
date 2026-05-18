import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DISTRICT_NAV } from "@/components/layout/role-shells";

const DOCS = [
  { k: "Data Privacy Addendum", desc: "Signed and on file with district legal.", state: "active" },
  {
    k: "COPPA verification flow",
    desc: "Required for every under-13 learner created under district schools.",
    state: "active",
  },
  {
    k: "FERPA records access",
    desc: "Parent self-service export available through Support.",
    state: "active",
  },
  { k: "Annual SOC 2 letter", desc: "Latest letter shared with district CIO.", state: "active" },
];

export default async function Page() {
  const session = await requirePageRole(["district_admin"]);
  return (
    <AppShell
      role="district_admin"
      roleLabel="District admin"
      navItems={DISTRICT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="District admin"
        title="Compliance"
        description="Documents and controls protecting student data across the district."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {DOCS.map((d) => (
          <Card key={d.k} className="p-[var(--aivo-density-card-pad)]">
            <div className="flex items-center justify-between">
              <p className="font-display text-lg font-semibold">{d.k}</p>
              <Badge tone="success">{d.state}</Badge>
            </div>
            <p className="mt-2 text-sm text-aivo-ink-soft">{d.desc}</p>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
