import { Badge } from "@/components/ui/badge";

type Maintenance = {
  id: string;
  title: string;
  state: string;
  scheduledStart: string;
  scheduledEnd: string;
};

function fmt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function stateTone(state: string): "primary" | "warning" | "neutral" {
  if (state === "in_progress") return "warning";
  if (state === "scheduled" || state === "upcoming") return "primary";
  return "neutral";
}

export function MaintenanceCalendar({ maintenances }: { maintenances: Maintenance[] }) {
  if (maintenances.length === 0) {
    return <p className="text-sm text-iw-ink-muted">No scheduled maintenance.</p>;
  }

  const inProgress = maintenances.filter((m) => m.state === "in_progress");
  const upcoming = maintenances
    .filter((m) => m.state !== "in_progress")
    .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));

  const renderGroup = (label: string, items: Maintenance[]) =>
    items.length === 0 ? null : (
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-iw-ink-muted">
          {label}
        </p>
        <ul className="divide-y divide-iw-border rounded-iw-card border border-iw-border">
          {items.map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-iw-ink">{m.title}</p>
                <p className="text-xs text-iw-ink-muted">
                  {fmt(m.scheduledStart)} – {fmt(m.scheduledEnd)}
                </p>
              </div>
              <Badge tone={stateTone(m.state)}>
                <span className="capitalize">{m.state.replace(/_/g, " ")}</span>
              </Badge>
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <div className="space-y-5">
      {renderGroup("In progress", inProgress)}
      {renderGroup("Upcoming", upcoming)}
    </div>
  );
}
