import Link from "next/link";
import { getPublicSummary } from "@/lib/services/status-page-svc";
import { ComponentMatrix } from "@/components/admin/status/ComponentMatrix";
import { IncidentBanner } from "@/components/admin/status/IncidentBanner";
import { MaintenanceCalendar } from "@/components/admin/status/MaintenanceCalendar";
import { SubscribeCard } from "@/components/admin/status/SubscribeCard";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

function impactTone(impact: string): "warning" | "danger" | "neutral" {
  if (impact === "critical" || impact === "major") return "danger";
  if (impact === "minor") return "warning";
  return "neutral";
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function PublicStatusPage() {
  const summary = await getPublicSummary();

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-8">
        <h1 className="font-iw-display text-3xl font-semibold text-iw-ink">System Status</h1>
        <p className="mt-1 text-sm text-iw-ink-muted">Live status of the AIVO learning platform.</p>
      </header>

      <IncidentBanner overall={summary.overall} incidents={summary.activeIncidents} />

      <section className="mt-10">
        <h2 className="mb-4 font-iw-display text-xl font-semibold text-iw-ink">Components</h2>
        <ComponentMatrix components={summary.components} />
      </section>

      {summary.activeIncidents.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-4 font-iw-display text-xl font-semibold text-iw-ink">
            Active incidents
          </h2>
          <ul className="space-y-3">
            {summary.activeIncidents.map((inc) => (
              <li
                key={inc.id}
                className="rounded-iw-card border border-iw-border bg-iw-card px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-iw-ink">{inc.title}</p>
                  <Badge tone={impactTone(inc.impact)}>
                    <span className="capitalize">{inc.impact}</span>
                  </Badge>
                </div>
                <p className="mt-1 text-xs capitalize text-iw-ink-muted">
                  {inc.lifecycle.replace(/_/g, " ")} · updated {fmtDate(inc.updatedAt)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="mb-4 font-iw-display text-xl font-semibold text-iw-ink">
          Scheduled maintenance
        </h2>
        <MaintenanceCalendar maintenances={summary.upcomingMaintenances} />
      </section>

      {summary.recentIncidents.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-4 font-iw-display text-xl font-semibold text-iw-ink">
            Recently resolved
          </h2>
          <ul className="divide-y divide-iw-border rounded-iw-card border border-iw-border">
            {summary.recentIncidents.map((inc) => (
              <li key={inc.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm text-iw-ink">{inc.title}</span>
                <span className="text-xs text-iw-ink-muted">
                  Resolved {fmtDate(inc.resolvedAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-10">
        <SubscribeCard />
      </section>

      <footer className="mt-12 border-t border-iw-border pt-6 text-xs text-iw-ink-muted">
        <p>
          Learn more about how we build and operate AI responsibly in our{" "}
          <Link href="/ai-transparency" className="font-medium text-iw-primary underline">
            AI transparency
          </Link>{" "}
          report.
        </p>
      </footer>
    </main>
  );
}
