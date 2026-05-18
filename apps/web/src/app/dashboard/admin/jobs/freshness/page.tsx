"use client";
import { useEffect, useState } from "react";

interface FreshnessReport {
  jobName: string;
  status: "fresh" | "warning" | "stale" | "never_run";
  ageMs: number | null;
  failed: boolean;
  lastFinishedAt: string | null;
}

interface FreshnessResponse {
  generatedAt: string;
  counts: { fresh: number; warning: number; stale: number; never_run: number; failed: number };
  reports: FreshnessReport[];
}

const TILE: Record<FreshnessReport["status"], { label: string; cls: string }> = {
  fresh: { label: "Fresh", cls: "bg-emerald-50 border-emerald-200" },
  warning: { label: "Warning", cls: "bg-amber-50 border-amber-200" },
  stale: { label: "Stale", cls: "bg-rose-50 border-rose-200" },
  never_run: { label: "Never run", cls: "bg-gray-100 border-gray-200" },
};

function formatAge(ms: number | null): string {
  if (ms == null) return "—";
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

export default function JobFreshnessPage() {
  const accessToken =
    typeof window !== "undefined" ? (window.localStorage.getItem("accessToken") ?? "") : "";
  const [data, setData] = useState<FreshnessResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    fetch("/api/admin-svc/jobs/freshness", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [accessToken]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Background Job Freshness</h1>
        <p className="text-sm text-gray-600">
          Single-pane view of every monitored job. Red tiles also page the on-call channel via the
          watchdog.
        </p>
      </header>

      {error && <p className="text-rose-600">Error: {error}</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <div className="rounded border p-3 bg-emerald-50 border-emerald-200">
              <div className="text-xs uppercase">Fresh</div>
              <div className="text-2xl font-bold">{data.counts.fresh}</div>
            </div>
            <div className="rounded border p-3 bg-amber-50 border-amber-200">
              <div className="text-xs uppercase">Warning</div>
              <div className="text-2xl font-bold">{data.counts.warning}</div>
            </div>
            <div className="rounded border p-3 bg-rose-50 border-rose-200">
              <div className="text-xs uppercase">Stale</div>
              <div className="text-2xl font-bold">{data.counts.stale}</div>
            </div>
            <div className="rounded border p-3 bg-gray-100 border-gray-200">
              <div className="text-xs uppercase">Never run</div>
              <div className="text-2xl font-bold">{data.counts.never_run}</div>
            </div>
            <div className="rounded border p-3 bg-rose-100 border-rose-300">
              <div className="text-xs uppercase">Last status: failed</div>
              <div className="text-2xl font-bold">{data.counts.failed}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.reports.map((r) => {
              const tile = TILE[r.status];
              return (
                <div
                  key={r.jobName}
                  data-testid={`freshness-${r.jobName}`}
                  className={`rounded border p-3 ${tile.cls} ${r.failed ? "ring-2 ring-rose-400" : ""}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs uppercase font-semibold">{tile.label}</span>
                    {r.failed && (
                      <span className="text-[10px] rounded bg-rose-200 text-rose-900 px-1">
                        failed
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-xs break-all">{r.jobName}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    Last finish:{" "}
                    {r.lastFinishedAt ? new Date(r.lastFinishedAt).toLocaleString() : "never"} (
                    {formatAge(r.ageMs)} ago)
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-gray-500 mt-4">
            Generated at {new Date(data.generatedAt).toLocaleString()}.
          </p>
        </>
      )}
    </div>
  );
}
