import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SCHOOL_NAV } from "@/components/layout/role-shells";

const ITEMS = [
  { k: "COPPA", desc: "Verifiable parental consent on every family signup.", state: "active" },
  { k: "FERPA", desc: "Education-record handling and parent-access workflow.", state: "active" },
  {
    k: "SOC 2 Type II",
    desc: "Annual audit covering security, availability, confidentiality.",
    state: "active",
  },
  {
    k: "State data privacy addendum",
    desc: "Signed by district legal — file lives in district admin.",
    state: "active",
  },
];

export default async function Page() {
  const session = await requirePageRole(["school_admin"]);
  const t = await getTranslations("admin.school_compliance");
  return (
    <AppShell
      role="school_admin"
      roleLabel="School admin"
      navItems={SCHOOL_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="School admin"
        title={t("title")}
        description="Snapshot of student-data protections for this school."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {ITEMS.map((i) => (
          <Card key={i.k} className="p-[var(--aivo-density-card-pad)]">
            <div className="flex items-center justify-between">
              <p className="font-display text-lg font-semibold">{i.k}</p>
              <Badge tone="success">{i.state}</Badge>
            </div>
            <p className="mt-2 text-sm text-aivo-ink-soft">{i.desc}</p>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
