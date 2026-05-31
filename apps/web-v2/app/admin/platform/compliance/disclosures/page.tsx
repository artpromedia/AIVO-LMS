import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { listDisclosures } from "@/lib/db/repos";
import { DisclosureForm } from "./form";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const t = await getTranslations("admin.platform_compliance_disclosures");
  const disclosures = listDisclosures(session.tenantId);

  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Compliance"
        title={t("title")}
        description="Every disclosure of personally identifiable information from an education record, per FERPA recordkeeping requirements."
      />

      <Card className="p-[var(--aivo-density-card-pad)]">
        <h2 className="font-display font-semibold">{t("record_heading")}</h2>
        <DisclosureForm />
      </Card>

      <Card className="mt-4 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-aivo-surface-2 text-left">
            <tr>
              <th className="p-3">When</th>
              <th className="p-3">{t("col_recipient")}</th>
              <th className="p-3">Type</th>
              <th className="p-3">{t("col_reason")}</th>
              <th className="p-3">{t("col_ferpa_basis")}</th>
            </tr>
          </thead>
          <tbody>
            {disclosures.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-aivo-ink-soft">
                  {t("empty_body")}
                </td>
              </tr>
            ) : (
              disclosures.map((d) => (
                <tr key={d.id} className="border-t border-aivo-border">
                  <td className="p-3 text-aivo-ink-soft">
                    {new Date(d.disclosedAt).toLocaleString()}
                  </td>
                  <td className="p-3">{d.recipientName}</td>
                  <td className="p-3">
                    <Badge tone="neutral">{d.recipientType}</Badge>
                  </td>
                  <td className="p-3 text-aivo-ink-soft">{d.reason}</td>
                  <td className="p-3 font-mono text-xs">{d.ferpaBasis}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </AppShell>
  );
}
