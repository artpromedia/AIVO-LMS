import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { scopeTenantsForSession, getBaselineRecalibrationForTenants } from "@/lib/db/repos";
import type { ItemPsychometrics } from "@/lib/db/types";
import { getTranslations } from "next-intl/server";

/**
 * Platform · Baseline item psychometrics (EPIC 5 / EPIC 2 admin view).
 *
 * Surfaces the live recalibration data so an admin can answer "are the
 * adaptive baseline items behaving as calibrated?" — exposure, p-value,
 * the refined difficulty estimate, and which items the system recommends
 * pulling for authoring review.
 */
export const dynamic = "force-dynamic";

const DIFFICULTY_TONE: Record<string, "success" | "primary" | "warning" | "danger" | "neutral"> = {
  foundational: "success",
  approaching: "primary",
  grade_level: "warning",
  stretch: "danger",
};

const DEFECT_LABELS: Record<string, string> = {
  harder_than_calibrated: "Harder than band",
  easier_than_calibrated: "Easier than band",
  near_zero_pvalue: "Almost always wrong",
  trivial_for_band: "Trivially easy",
  high_skip_rate: "High skip rate",
};

function fmtDifficulty(d: string): string {
  return d.replaceAll("_", " ");
}

function signed(n: number): string {
  return n > 0 ? `+${n.toFixed(2)}` : n.toFixed(2);
}

function rowTone(row: ItemPsychometrics): "danger" | "warning" | "neutral" {
  if (row.recommendRetire) return "danger";
  if (row.defectReasons.length > 0) return "warning";
  return "neutral";
}

export default async function Page() {
  const t = await getTranslations("admin.platform_baseline_items");
  const session = await requirePageRole(["platform_admin"]);
  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  const tenantIds = tenants.map((t) => t.id);
  const items = await getBaselineRecalibrationForTenants({ tenantIds });

  const calibratable = items.filter((i) => i.sufficientData).length;
  const flagged = items.filter((i) => i.defectReasons.length > 0).length;
  const retire = items.filter((i) => i.recommendRetire).length;
  const totalExposure = items.reduce((acc, i) => acc + i.exposure, 0);

  const summary = [
    { k: "Items observed", v: items.length.toLocaleString() },
    { k: "Calibratable", v: calibratable.toLocaleString() },
    { k: "Flagged", v: flagged.toLocaleString() },
    { k: "Recommend retire", v: retire.toLocaleString() },
  ];

  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Assessment quality"
        title={t("title")}
        description="Live recalibration of adaptive-baseline items: exposure, p-value, and difficulty drift from learner responses."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summary.map((s) => (
          <Card key={s.k} className="p-[var(--aivo-density-card-pad)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">{s.k}</p>
            <p className="mt-1 font-display text-3xl font-bold">{s.v}</p>
          </Card>
        ))}
      </div>

      <SectionHeader
        className="mt-8"
        title={t("items_by_exposure")}
        description={
          items.length === 0
            ? "No baseline telemetry captured yet."
            : `${totalExposure.toLocaleString()} administrations across ${items.length} item${items.length === 1 ? "" : "s"}. Estimated difficulty (θ̂) is a 1-PL fit; items need enough scored responses before it is trusted.`
        }
      />

      {items.length === 0 ? (
        <EmptyState
          title={t("no_telemetry_yet")}
          description="Once learners complete adaptive baselines, per-item psychometrics appear here."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-aivo-surface-2 text-left">
                <tr>
                  <th className="p-3">{t("col_item")}</th>
                  <th className="p-3 text-right">{t("col_exposure")}</th>
                  <th className="p-3 text-right">{t("col_scored")}</th>
                  <th className="p-3 text-right">p-value</th>
                  <th className="p-3 text-right">{t("col_median_time")}</th>
                  <th className="p-3 text-right">{t("col_seed_theta")}</th>
                  <th className="p-3 text-right">{t("col_est_theta")}</th>
                  <th className="p-3 text-right">Δθ</th>
                  <th className="p-3 text-right">{t("col_disc")}</th>
                  <th className="p-3">{t("col_suggested_band")}</th>
                  <th className="p-3">{t("col_status")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const tone = rowTone(row);
                  return (
                    <tr key={row.itemKey} className="border-t border-aivo-border align-top">
                      <td className="p-3">
                        <span className="font-medium">{row.skillId}</span>{" "}
                        <Badge tone={DIFFICULTY_TONE[row.difficulty] ?? "neutral"}>
                          {fmtDifficulty(row.difficulty)}
                        </Badge>
                      </td>
                      <td className="p-3 text-right text-aivo-ink-soft">{row.exposure}</td>
                      <td className="p-3 text-right text-aivo-ink-soft">{row.scored}</td>
                      <td className="p-3 text-right text-aivo-ink-soft">
                        {row.scored > 0 ? row.pValue.toFixed(2) : "—"}
                      </td>
                      <td className="p-3 text-right text-aivo-ink-soft">
                        {row.medianLatencyMs !== null
                          ? `${(row.medianLatencyMs / 1000).toFixed(1)}s`
                          : "—"}
                      </td>
                      <td className="p-3 text-right text-aivo-ink-soft">
                        {row.seedTheta.toFixed(2)}
                      </td>
                      <td className="p-3 text-right text-aivo-ink-soft">
                        {row.sufficientData ? row.estimatedTheta.toFixed(2) : "—"}
                      </td>
                      <td className="p-3 text-right text-aivo-ink-soft">
                        {row.sufficientData ? signed(row.thetaDelta) : "—"}
                      </td>
                      <td className="p-3 text-right text-aivo-ink-soft">
                        {row.sufficientData ? row.estimatedDiscrimination.toFixed(2) : "—"}
                      </td>
                      <td className="p-3">
                        {row.sufficientData ? (
                          <Badge tone={DIFFICULTY_TONE[row.suggestedDifficulty] ?? "neutral"}>
                            {fmtDifficulty(row.suggestedDifficulty)}
                          </Badge>
                        ) : (
                          <span className="text-aivo-ink-soft">needs data</span>
                        )}
                      </td>
                      <td className="p-3">
                        {tone === "neutral" ? (
                          row.sufficientData ? (
                            <Badge tone="success">{t("status_healthy")}</Badge>
                          ) : (
                            <Badge tone="neutral">{t("status_collecting")}</Badge>
                          )
                        ) : (
                          <div className="flex flex-col gap-1">
                            {row.recommendRetire ? (
                              <Badge tone="danger">{t("status_retire")}</Badge>
                            ) : null}
                            {row.defectReasons.map((d) => (
                              <Badge key={d} tone="warning">
                                {DEFECT_LABELS[d] ?? d}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </AppShell>
  );
}
