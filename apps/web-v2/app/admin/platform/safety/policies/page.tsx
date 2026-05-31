import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { listSafetyPolicyVersions } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const t = await getTranslations("admin.platform_safety_policies");
  const policies = listSafetyPolicyVersions();
  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Safety"
        title={t("title")}
        description="The active SafetyPolicyVersion drives every classification. Versions are immutable; new thresholds ship as a new version."
      />
      <div className="space-y-3">
        {policies.map((p) => (
          <Card key={p.id} className="p-[var(--aivo-density-card-pad)]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display font-semibold">Version {p.version}</h2>
                <p className="text-xs text-aivo-muted">
                  Effective {new Date(p.effectiveAt).toLocaleString()}
                </p>
              </div>
              <Badge tone={p.status === "active" ? "success" : "neutral"}>{p.status}</Badge>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-aivo-muted text-xs uppercase">{t("label_block_threshold")}</dt>
                <dd className="font-medium">{p.ruleset.blockThreshold}</dd>
              </div>
              <div>
                <dt className="text-aivo-muted text-xs uppercase">{t("label_review_threshold")}</dt>
                <dd className="font-medium">{p.ruleset.reviewThreshold}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-aivo-muted text-xs uppercase">{t("label_auto_review_categories")}</dt>
                <dd className="flex flex-wrap gap-1 mt-1">
                  {p.ruleset.autoReviewCategories.map((c) => (
                    <Badge key={c} tone="warning">
                      {c.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-aivo-muted text-xs uppercase">{t("label_auto_block_categories")}</dt>
                <dd className="flex flex-wrap gap-1 mt-1">
                  {p.ruleset.autoBlockCategories.map((c) => (
                    <Badge key={c} tone="danger">
                      {c.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </dd>
              </div>
            </dl>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
