import { requirePlatformPage } from "@aivo/admin-auth";
import { ADMIN_CHART_PALETTE } from "@aivo/brand";
import { AdminPageFrame } from "@aivo/admin-ui";

export const dynamic = "force-dynamic";

/**
 * Palette verification page for the admin chart tokens. Renders the
 * --admin-chart-* custom properties (emitted by @aivo/brand) next to their
 * canonical ADMIN_CHART_PALETTE values so a reviewer can confirm the running
 * CSS resolves to the reference violet/teal/orange ramp. RBAC-gated like every
 * /platform route.
 */
const SERIES = [
  { token: "--admin-chart-1", label: "Series 1 · primary (violet)" },
  { token: "--admin-chart-2", label: "Series 2 · positive (teal)" },
  { token: "--admin-chart-3", label: "Series 3 · warning (orange)" },
  { token: "--admin-chart-4", label: "Series 4 · danger (pink)" },
  { token: "--admin-chart-5", label: "Series 5 · neutral (slate)" },
] as const;

const SUPPORT = [
  { token: "--admin-chart-grid", label: "Grid", value: ADMIN_CHART_PALETTE.grid },
  { token: "--admin-chart-axis", label: "Axis", value: ADMIN_CHART_PALETTE.axis },
  { token: "--admin-chart-ink", label: "Ink", value: ADMIN_CHART_PALETTE.ink },
] as const;

export default async function ChartCheckPage() {
  await requirePlatformPage("platform:read");

  return (
    <AdminPageFrame
      eyebrow="AIVO Admin"
      title="Chart palette check"
      description="Each swatch is painted with the live var(--admin-chart-*) custom property (single source of truth in @aivo/brand). The hex shown is the canonical ADMIN_CHART_PALETTE value it should resolve to."
    >
      <section className="mt-8">
        <h2 className="admin-h2">Series</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERIES.map((s, i) => (
            <li
              key={s.token}
              className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4"
            >
              <span
                aria-hidden
                className="h-12 w-12 shrink-0 rounded-lg ring-1 ring-black/5"
                style={{ background: `var(${s.token})` }}
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-800">{s.label}</span>
                <span className="block font-mono text-xs text-slate-500">{s.token}</span>
                <span className="admin-tabular block font-mono text-xs text-slate-500">
                  {ADMIN_CHART_PALETTE.series[i]}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="admin-h2">Grid / axis / ink</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-3">
          {SUPPORT.map((s) => (
            <li
              key={s.token}
              className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4"
            >
              <span
                aria-hidden
                className="h-12 w-12 shrink-0 rounded-lg ring-1 ring-black/5"
                style={{ background: `var(${s.token})` }}
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-800">{s.label}</span>
                <span className="block font-mono text-xs text-slate-500">{s.token}</span>
                <span className="block font-mono text-xs text-slate-500">{s.value}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </AdminPageFrame>
  );
}
