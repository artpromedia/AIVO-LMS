import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { listRetentionPolicies, previewRetention } from "@/lib/compliance/governance-store";
import { RetentionPolicyEditor } from "@/components/admin/compliance/retention-policy-editor";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const t = await getTranslations("admin.platform_compliance_retention");
  const policies = listRetentionPolicies();

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
        description="Retention windows, disposition, and legal hold settings per data classification. The preview column shows how many synthetic records would be eligible for action."
      />

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-aivo-surface-2 text-left">
            <tr>
              <th className="p-3">{t("col_classification")}</th>
              <th className="p-3">{t("col_retention_days")}</th>
              <th className="p-3">Disposition</th>
              <th className="p-3">Legal hold</th>
              <th className="p-3">Eligible / Total</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {policies.map((p) => (
              <RetentionPolicyEditor
                key={p.dataClass}
                dataClass={p}
                retention={p.retention}
                preview={previewRetention(p.dataClass)}
              />
            ))}
          </tbody>
        </table>
      </Card>
    </AppShell>
  );
}
