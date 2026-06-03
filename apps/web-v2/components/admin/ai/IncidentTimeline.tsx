interface TimelineEntry {
  at: string;
  actor: string;
  state: string;
  note: string;
}

interface IncidentTimelineProps {
  timeline: TimelineEntry[];
}

/**
 * Vertical timeline list of incident state transitions. Server component.
 */
export function IncidentTimeline({ timeline }: IncidentTimelineProps) {
  if (!timeline || timeline.length === 0) {
    return <p className="text-sm text-aivo-ink-soft">No timeline entries.</p>;
  }

  return (
    <ol className="space-y-4">
      {timeline.map((entry, idx) => (
        <li key={idx} className="relative flex gap-4 pl-2">
          <div className="flex flex-col items-center">
            <span className="mt-1 h-3 w-3 rounded-full bg-aivo-primary" />
            {idx < timeline.length - 1 ? (
              <span className="mt-1 w-px flex-1 bg-aivo-border" />
            ) : null}
          </div>
          <div className="pb-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold capitalize">{entry.state.replace(/_/g, " ")}</span>
              <span className="text-xs text-aivo-ink-soft">{entry.actor}</span>
              <span className="text-xs text-aivo-ink-soft">
                {new Date(entry.at).toLocaleString()}
              </span>
            </div>
            {entry.note ? <p className="mt-1 text-sm text-aivo-ink-soft">{entry.note}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
