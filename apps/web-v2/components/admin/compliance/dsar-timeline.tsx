import type { DsarEvent } from "@/lib/compliance/governance-store";

export function DsarTimeline({ events }: { events: DsarEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-aivo-ink-soft">No events recorded.</p>;
  }
  return (
    <ol className="relative border-l border-aivo-border pl-6 space-y-4">
      {events.map((ev) => (
        <li key={ev.id} className="relative">
          <span className="absolute -left-[1.3125rem] top-1 h-3 w-3 rounded-full border-2 border-iw-primary bg-iw-raised" />
          <p className="text-sm font-semibold capitalize">{ev.eventType.replace(/_/g, " ")}</p>
          <p className="text-xs text-aivo-ink-soft">
            {ev.actorRole ? <span className="mr-1 font-mono">[{ev.actorRole}]</span> : null}
            {new Date(ev.createdAt).toLocaleString()}
          </p>
          {Object.keys(ev.detail).length > 0 && (
            <ul className="mt-1 text-xs text-aivo-ink-soft list-disc pl-4 space-y-0.5">
              {Object.entries(ev.detail).map(([k, v]) => (
                <li key={k}>
                  <span className="font-medium">{k}:</span> <span>{String(v)}</span>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}
