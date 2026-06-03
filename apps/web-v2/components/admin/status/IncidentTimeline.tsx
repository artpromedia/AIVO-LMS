import { Badge } from "@/components/ui/badge";

type Update = {
  lifecycle: string;
  body: string;
  author: string;
  createdAt: string;
};

function lifecycleTone(lc: string): "primary" | "warning" | "success" | "neutral" {
  switch (lc) {
    case "resolved":
      return "success";
    case "monitoring":
      return "primary";
    case "investigating":
    case "identified":
      return "warning";
    default:
      return "neutral";
  }
}

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

export function IncidentTimeline({ updates }: { updates: Update[] }) {
  if (!updates || updates.length === 0) {
    return <p className="text-sm text-iw-ink-muted">No updates yet.</p>;
  }
  const ordered = [...updates].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <ol className="relative space-y-6 border-l border-iw-border pl-6">
      {ordered.map((u, i) => (
        <li key={`${u.createdAt}-${i}`} className="relative">
          <span className="absolute -left-[1.625rem] top-1 h-3 w-3 rounded-full bg-iw-primary ring-4 ring-iw-card" aria-hidden />
          <div className="flex items-center gap-2">
            <Badge tone={lifecycleTone(u.lifecycle)}>
              <span className="capitalize">{u.lifecycle.replace(/_/g, " ")}</span>
            </Badge>
            <span className="text-xs text-iw-ink-muted">{fmt(u.createdAt)}</span>
          </div>
          <p className="mt-1 text-sm text-iw-ink">{u.body}</p>
          {u.author ? <p className="mt-0.5 text-xs text-iw-ink-muted">— {u.author}</p> : null}
        </li>
      ))}
    </ol>
  );
}
