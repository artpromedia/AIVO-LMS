function worst(
  incidents: Array<{ title: string; lifecycle: string; impact: string }>,
): { title: string; lifecycle: string; impact: string } | null {
  if (incidents.length === 0) return null;
  const rank: Record<string, number> = { critical: 3, major: 2, minor: 1, none: 0 };
  return [...incidents].sort((a, b) => (rank[b.impact] ?? 0) - (rank[a.impact] ?? 0))[0];
}

export function IncidentBanner({
  overall,
  incidents = [],
}: {
  overall: string;
  incidents?: Array<{ title: string; lifecycle: string; impact: string }>;
}) {
  const active = incidents.length > 0;
  const lead = worst(incidents);
  const critical =
    lead?.impact === "critical" || lead?.impact === "major" || overall === "major_outage";

  if (!active && overall === "operational") {
    return (
      <div className="flex items-center gap-3 rounded-iw-hero border border-iw-border bg-aivo-success/15 px-6 py-5">
        <span className="h-3 w-3 rounded-full bg-aivo-success" aria-hidden />
        <p className="font-iw-display text-xl font-semibold text-iw-ink">All Systems Operational</p>
      </div>
    );
  }

  const toneClass = critical ? "bg-aivo-danger/15" : "bg-aivo-warning/15";
  const dotClass = critical ? "bg-aivo-danger" : "bg-aivo-warning";
  const headline = active
    ? (lead?.title ?? "Active incident in progress")
    : "Some systems are experiencing issues";

  return (
    <div className={`rounded-iw-hero border border-iw-border ${toneClass} px-6 py-5`}>
      <div className="flex items-center gap-3">
        <span className={`h-3 w-3 rounded-full ${dotClass}`} aria-hidden />
        <p className="font-iw-display text-xl font-semibold text-iw-ink">{headline}</p>
      </div>
      {active && lead ? (
        <p className="mt-1 text-sm capitalize text-iw-ink-muted">
          {lead.impact} impact · {lead.lifecycle.replace(/_/g, " ")}
          {incidents.length > 1 ? ` · +${incidents.length - 1} more` : ""}
        </p>
      ) : null}
    </div>
  );
}
