import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SisConnector, SyncRun, RunStatus } from "@/lib/db/sis-store";

/**
 * SyncStatusCard — modernized port of ADR 106's "SIS Sync Status card".
 * Presentational: shows a connector's provider, health, last-run counts,
 * and schedule. Reused by the district list and the platform overview.
 */
const STATUS_TONE: Record<RunStatus, "success" | "warning" | "danger" | "neutral"> = {
  success: "success",
  running: "neutral",
  paused: "warning",
  failed: "danger",
};

const PROVIDER_LABEL: Record<string, string> = {
  oneroster_rest: "OneRoster REST",
  oneroster_csv: "OneRoster CSV",
  clever: "Clever",
  classlink: "ClassLink",
};

export function SyncStatusCard({
  connector,
  latestRun,
}: {
  connector: SisConnector;
  latestRun: SyncRun | null;
}) {
  const tone = latestRun ? STATUS_TONE[latestRun.status] : "neutral";
  const counts = latestRun?.counts;
  return (
    <Card className="p-[var(--aivo-density-card-pad)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display font-semibold">{connector.displayName}</p>
          <p className="text-xs text-aivo-ink-soft">
            {PROVIDER_LABEL[connector.provider] ?? connector.provider}
          </p>
        </div>
        <Badge tone={tone}>
          {latestRun ? latestRun.status.toUpperCase() : "NEVER RUN"}
        </Badge>
      </div>
      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-aivo-ink-soft">Last sync</dt>
          <dd>{latestRun ? new Date(latestRun.startedAt).toLocaleString() : "—"}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-aivo-ink-soft">Rows (add / upd / del)</dt>
          <dd>
            {counts ? `${counts.added} / ${counts.updated} / ${counts.removed}` : "—"}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-aivo-ink-soft">Errors</dt>
          <dd>{latestRun?.errorCount ?? 0}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-aivo-ink-soft">Nightly / delta</dt>
          <dd className="text-xs">
            <code>{connector.fullScheduleCron}</code> · <code>{connector.deltaScheduleCron}</code>
          </dd>
        </div>
      </dl>
      {latestRun?.pauseReason ? (
        <p className="mt-2 rounded border border-aivo-warning/40 bg-aivo-warning/10 p-2 text-xs">
          {latestRun.pauseReason}
        </p>
      ) : null}
    </Card>
  );
}
