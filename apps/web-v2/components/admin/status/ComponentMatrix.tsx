import { Badge } from "@/components/ui/badge";

type ComponentStatus = string;

function statusTone(
  status: ComponentStatus,
): "success" | "primary" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "operational":
      return "success";
    case "under_maintenance":
      return "primary";
    case "degraded_performance":
    case "partial_outage":
      return "warning";
    case "major_outage":
      return "danger";
    default:
      return "neutral";
  }
}

function statusLabel(status: ComponentStatus): string {
  return status.replace(/_/g, " ");
}

function dotClass(status: ComponentStatus): string {
  switch (status) {
    case "operational":
      return "bg-iw-success";
    case "under_maintenance":
      return "bg-iw-primary";
    case "degraded_performance":
    case "partial_outage":
      return "bg-iw-warning";
    case "major_outage":
      return "bg-iw-error";
    default:
      return "bg-iw-border";
  }
}

export function ComponentMatrix({
  components,
}: {
  components: Array<{ id: string; name: string; group: string; status: string }>;
}) {
  const groups = new Map<
    string,
    Array<{ id: string; name: string; group: string; status: string }>
  >();
  for (const c of components) {
    const key = c.group || "Other";
    const arr = groups.get(key) ?? [];
    arr.push(c);
    groups.set(key, arr);
  }

  if (components.length === 0) {
    return <p className="text-sm text-iw-ink-muted">No components reported.</p>;
  }

  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([group, items]) => (
        <div key={group}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-iw-ink-muted">
            {group}
          </p>
          <ul className="divide-y divide-iw-border rounded-iw-card border border-iw-border">
            {items.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="flex items-center gap-3 text-sm">
                  <span className={`h-2.5 w-2.5 rounded-full ${dotClass(c.status)}`} aria-hidden />
                  {c.name}
                </span>
                <Badge tone={statusTone(c.status)}>
                  <span className="capitalize">{statusLabel(c.status)}</span>
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
