import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { listAudioAssets, listReadAloudUsage, summarizeAudioUsage } from "@/lib/db/repos";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

function fmtUsd(microUsd: number): string {
  return `$${(microUsd / 1_000_000).toFixed(4)}`;
}

export default async function Page() {
  const t = await getTranslations("admin.platform_audio");
  const session = await requirePageRole(["platform_admin"]);
  const summary = summarizeAudioUsage();
  const events = listReadAloudUsage().slice(0, 20);
  const assets = listAudioAssets().slice(0, 5);
  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform"
        title={t("title")}
        description="TTS usage, cache effectiveness, and pronunciation overrides across the platform."
        actions={
          <Link
            href="/admin/platform/audio/pronunciation"
            className="rounded-md border border-aivo-line bg-aivo-surface px-3 py-1.5 text-sm font-medium"
          >
            {t("pronunciation_overrides")}
          </Link>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase text-aivo-muted">{t("playbacks")}</p>
          <p className="mt-1 font-display text-3xl font-bold">
            {summary.totalPlaybacks.toLocaleString()}
          </p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase text-aivo-muted">{t("cache_hit_rate")}</p>
          <p className="mt-1 font-display text-3xl font-bold">
            {(summary.cacheHitRate * 100).toFixed(0)}%
          </p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase text-aivo-muted">{t("total_cost")}</p>
          <p className="mt-1 font-display text-3xl font-bold">
            {fmtUsd(summary.totalCostMicroUsd)}
          </p>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase text-aivo-muted">{t("unique_clips")}</p>
          <p className="mt-1 font-display text-3xl font-bold">
            {summary.uniqueAssets.toLocaleString()}
          </p>
        </Card>
      </div>

      <Card className="mt-4 p-0 overflow-hidden">
        <div className="border-b px-4 py-3">
          <h2 className="font-display font-semibold">{t("recent_playbacks")}</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-aivo-surface-2 text-xs uppercase text-aivo-muted">
            <tr>
              <th className="px-4 py-2 text-left">When</th>
              <th className="px-4 py-2 text-left">{t("col_context")}</th>
              <th className="px-4 py-2 text-left">Cache</th>
              <th className="px-4 py-2 text-left">Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {events.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-aivo-muted">
                  {t("no_playbacks_yet")}
                </td>
              </tr>
            ) : (
              events.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-2 text-[11px] text-aivo-muted whitespace-nowrap">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">{e.contextKind.replace(/_/g, " ")}</td>
                  <td className="px-4 py-2">
                    <Badge tone={e.cacheHit ? "success" : "neutral"}>
                      {e.cacheHit ? "hit" : "miss"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2">{fmtUsd(e.costMicroUsd)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {assets.length > 0 && (
        <Card className="mt-4 p-[var(--aivo-density-card-pad)]">
          <h2 className="font-display font-semibold">{t("recently_generated_clips")}</h2>
          <ul className="mt-2 divide-y text-sm">
            {assets.map((a) => (
              <li key={a.id} className="py-2 flex items-center justify-between gap-2">
                <span className="truncate">
                  {a.text.slice(0, 80)}
                  {a.text.length > 80 ? "…" : ""}
                </span>
                <span className="text-[11px] text-aivo-muted whitespace-nowrap">
                  {a.voiceId} · {(a.durationMs / 1000).toFixed(1)}s · {fmtUsd(a.costMicroUsd)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </AppShell>
  );
}
