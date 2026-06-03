import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { ReportCatalogItem } from "@/lib/services/reports-svc";

function scopeTone(scope: string): "primary" | "accent" | "warm" | "neutral" {
  switch (scope) {
    case "platform":
      return "accent";
    case "district":
      return "primary";
    case "school":
      return "warm";
    default:
      return "neutral";
  }
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function ReportCatalog({
  reports,
  basePath,
}: {
  reports: ReportCatalogItem[];
  basePath: string;
}) {
  if (!reports || reports.length === 0) {
    return (
      <EmptyState
        title="No reports available"
        description="There are no reports in the catalog for your scope yet."
      />
    );
  }

  const grouped = new Map<string, ReportCatalogItem[]>();
  for (const report of reports) {
    const key = report.category || "Other";
    const list = grouped.get(key);
    if (list) list.push(report);
    else grouped.set(key, [report]);
  }

  return (
    <div className="space-y-8">
      {Array.from(grouped.entries()).map(([category, items]) => (
        <section key={category}>
          <p className="mb-3 font-iw-display text-lg font-semibold text-iw-ink">{category}</p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items.map((report) => (
              <Link key={report.id} href={`${basePath}/${report.id}`} className="block">
                <Card className="h-full p-[var(--aivo-density-card-pad)] transition-colors hover:bg-iw-card-soft/40">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-iw-display text-base font-semibold text-iw-ink">
                      {report.title}
                    </p>
                    <div className="flex flex-wrap justify-end gap-1">
                      {(report.scopes ?? []).map((s) => (
                        <Badge key={s} tone={scopeTone(s)}>
                          <span className="capitalize">{s}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-iw-ink-muted">{report.description}</p>
                  <dl className="mt-4 flex items-center justify-between text-xs text-iw-ink-muted">
                    <div>
                      <dt className="uppercase tracking-wide">Owner</dt>
                      <dd className="mt-0.5 text-iw-ink">{report.owner}</dd>
                    </div>
                    <div className="text-right">
                      <dt className="uppercase tracking-wide">Last reviewed</dt>
                      <dd className="mt-0.5 text-iw-ink">{fmtDate(report.lastReviewed)}</dd>
                    </div>
                  </dl>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
