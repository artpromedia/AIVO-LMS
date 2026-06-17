"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Run = {
  status?: string;
  rowCount?: number;
  format?: string;
  cached?: boolean;
  error?: { code?: string; message?: string } | string | null;
  lineage?: { sources?: Array<{ service?: string; query?: string; queryVersion?: string }> };
} & Record<string, unknown>;

function statusTone(status?: string): "success" | "danger" | "primary" | "neutral" {
  if (status === "succeeded") return "success";
  if (status === "failed") return "danger";
  if (status === "running" || status === "pending" || status === "queued") return "primary";
  return "neutral";
}

const TERMINAL = new Set(["succeeded", "failed"]);

export function RunStatusCard({ runId, initialRun }: { runId: string; initialRun?: Run }) {
  const [run, setRun] = React.useState<Run | null>(initialRun ?? null);
  const [polling, setPolling] = React.useState(
    !initialRun || !TERMINAL.has(String(initialRun.status)),
  );

  React.useEffect(() => {
    if (run && TERMINAL.has(String(run.status))) {
      setPolling(false);
      return;
    }
    let active = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/bff/admin/reports/runs/${runId}`);
        const json = await res.json().catch(() => null);
        if (!active) return;
        if (json?.ok && json.data) {
          setRun(json.data as Run);
          if (TERMINAL.has(String(json.data.status))) {
            setPolling(false);
            clearInterval(interval);
          }
        }
      } catch {
        /* keep polling */
      }
    }, 1500);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [runId, run?.status]);

  const status = run?.status ?? "pending";
  const sources = run?.lineage?.sources ?? [];
  const error = typeof run?.error === "string" ? { message: run.error } : (run?.error ?? null);
  const succeeded = status === "succeeded";

  return (
    <Card className="p-[var(--aivo-density-card-pad)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Badge tone={statusTone(status)}>
            <span className="capitalize">{status}</span>
          </Badge>
          {polling ? <span className="text-xs text-iw-ink-muted">Refreshing…</span> : null}
        </div>
        {succeeded ? (
          <a
            href={`/api/bff/admin/reports/runs/${runId}/download`}
            download
            className="inline-flex h-11 items-center rounded-full bg-iw-primary px-5 text-sm font-semibold text-iw-primary-fg"
          >
            Download
          </a>
        ) : (
          <Button
            variant="outline"
            disabled
            title={
              status === "failed"
                ? "This report run failed — re-run it to download."
                : "Download will be available once the report finishes generating."
            }
            aria-label={
              status === "failed"
                ? "Download unavailable: this report run failed"
                : "Download available once the report finishes generating"
            }
          >
            Download
          </Button>
        )}
      </div>

      {status === "failed" ? (
        <div className="mt-4 rounded-iw-card border border-iw-error/40 bg-iw-error/10 p-3 text-sm">
          <p className="font-semibold text-iw-ink">{error?.code ?? "Run failed"}</p>
          {error?.message ? <p className="mt-0.5 text-iw-ink-muted">{error.message}</p> : null}
        </div>
      ) : (
        <dl className="mt-4 grid gap-4 sm:grid-cols-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-iw-ink-muted">Rows</dt>
            <dd className="mt-0.5 tabular-nums text-iw-ink">
              {run?.rowCount != null ? run.rowCount.toLocaleString() : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-iw-ink-muted">Format</dt>
            <dd className="mt-0.5 uppercase text-iw-ink">{run?.format ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-iw-ink-muted">Cached</dt>
            <dd className="mt-0.5 text-iw-ink">{run?.cached ? "Yes" : "No"}</dd>
          </div>
        </dl>
      )}

      <div className="mt-6">
        <p className="text-xs uppercase tracking-wide text-iw-ink-muted">Lineage</p>
        {sources.length === 0 ? (
          <p className="mt-1 text-sm text-iw-ink-muted">No lineage recorded.</p>
        ) : (
          <table className="mt-2 w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-iw-ink-muted">
              <tr>
                <th className="py-1 text-left">Service</th>
                <th className="py-1 text-left">Query</th>
                <th className="py-1 text-left">Version</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-iw-border">
              {sources.map((s, i) => (
                <tr key={i}>
                  <td className="py-1 text-iw-ink">{s.service ?? "—"}</td>
                  <td className="py-1 text-iw-ink-muted">{s.query ?? "—"}</td>
                  <td className="py-1 text-iw-ink-muted">{s.queryVersion ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
