import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DISTRICT_NAV } from "@/components/layout/role-shells";
import { listDsars, computeKpis, scopeForSession } from "@/lib/compliance/governance-store";
import { DsarQueueTable } from "@/components/admin/compliance/dsar-queue-table";
import { ConsentSearch } from "@/components/admin/compliance/consent-search";

export const dynamic = "force-dynamic";

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
  const t = await getTranslations("admin.district_compliance");

  const tenantScope = scopeForSession("district_admin", session.tenantId);
  const dsars = listDsars({ tenantScope });
  const kpis = computeKpis(dsars);

  return (
    <AppShell
      role="district_admin"
      roleLabel="District admin"
      navItems={DISTRICT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="District admin"
        title={t("title")}
        description="Documents and controls protecting student data across the district."
      />

      {/* Compliance docs */}
      <div className="grid gap-3 sm:grid-cols-2 mb-6">
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

      {/* DSAR KPIs */}
      <h2 className="font-display font-semibold text-lg mb-3">DSAR requests (district scope)</h2>
      <div className="grid gap-3 sm:grid-cols-3 mb-4">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase text-aivo-muted">Open</p>
          <p className="mt-1 font-display text-2xl font-bold">{kpis.open}</p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase text-aivo-muted">Overdue</p>
          <p
            className={`mt-1 font-display text-2xl font-bold ${kpis.overdue > 0 ? "text-aivo-danger" : ""}`}
          >
            {kpis.overdue}
          </p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase text-aivo-muted">Avg fulfillment</p>
          <p className="mt-1 font-display text-2xl font-bold">
            {kpis.avgFulfillmentHours !== null
              ? `${Math.round(kpis.avgFulfillmentHours / 24)}d`
              : "—"}
          </p>
        </Card>
      </div>

      <DsarQueueTable dsars={dsars} detailBase="/admin/district/compliance/dsar" />

      {/* Consent search */}
      <h2 className="font-display font-semibold text-lg mt-8 mb-3">Consent records</h2>
      <Card className="p-[var(--aivo-density-card-pad)]">
        <ConsentSearch />
      </Card>
    </AppShell>
  );
}
