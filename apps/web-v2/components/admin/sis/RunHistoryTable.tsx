import { Badge } from "@/components/ui/badge";
import type { SyncRun, RunStatus } from "@/lib/db/sis-store";

const STATUS_TONE: Record<RunStatus, "success" | "warning" | "danger" | "neutral"> = {
  success: "success",
  running: "neutral",
  paused: "warning",
  failed: "danger",
};

/** Presentational run-history table for a connector's last N runs. */
export function RunHistoryTable({ runs }: { runs: SyncRun[] }) {
  if (runs.length === 0) {
    return <p className="text-sm text-aivo-ink-soft">No sync runs yet.</p>;
  }
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Sync run history</caption>
      <thead>
        <tr className="text-left text-xs text-aivo-ink-soft">
          <th scope="col" className="py-1">
            Started
          </th>
          <th scope="col">Type</th>
          <th scope="col">Status</th>
          <th scope="col" className="text-right">
            Add
          </th>
          <th scope="col" className="text-right">
            Upd
          </th>
          <th scope="col" className="text-right">
            Del
          </th>
          <th scope="col" className="text-right">
            Errors
          </th>
        </tr>
      </thead>
      <tbody>
        {runs.map((r) => (
          <tr key={r.id} className="border-t border-aivo-border">
            <td className="py-1">{new Date(r.startedAt).toLocaleString()}</td>
            <td>
              {r.type}
              {r.dryRun ? <span className="ml-1 text-xs text-aivo-ink-soft">(dry-run)</span> : null}
            </td>
            <td>
              <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
            </td>
            <td className="text-right">{r.counts.added}</td>
            <td className="text-right">{r.counts.updated}</td>
            <td className="text-right">{r.counts.removed}</td>
            <td className="text-right">{r.errorCount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
