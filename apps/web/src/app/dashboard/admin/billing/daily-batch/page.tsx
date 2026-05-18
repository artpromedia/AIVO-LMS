"use client";
import { useAuth } from "@/providers/auth-provider";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  readParamArray,
  readParamString,
  readWindowSearchParams,
  useSyncFiltersToUrl,
} from "@/hooks/use-url-filters";

interface LatestRow {
  jobName: string;
  lastRunAt: string | null;
  lastFinishedAt: string | null;
  lastReplicaId: string | null;
  lastStatus: string | null;
  lastSent: number | null;
  lastFailed: number | null;
  lastError: string | null;
}

interface HistoryRow {
  id: number;
  runAt: string;
  finishedAt: string | null;
  replicaId: string | null;
  status: string;
  sent: number | null;
  failed: number | null;
  durationMs: number | null;
  error: string | null;
}

interface StatusResponse {
  latest: LatestRow | null;
  filters: { statuses: string[] | null; since: string | null; until: string | null; limit: number };
  history: HistoryRow[];
}

const FILTER_KEY = "aivo:admin:billing-daily-batch:filters";
const STATUS_OPTIONS = ["ok", "partial", "failed"] as const;

function loadInitialFilters(): { statuses: string[]; since: string; until: string } {
  // URL params win over localStorage so a deep link / refresh restores the
  // operator's view even on a fresh tab.
  const url = readWindowSearchParams();
  if (url && (url.has("status") || url.has("since") || url.has("until"))) {
    return {
      statuses: readParamArray(url, "status"),
      since: readParamString(url, "since"),
      until: readParamString(url, "until"),
    };
  }
  if (typeof window === "undefined") return { statuses: [], since: "", until: "" };
  try {
    const raw = window.localStorage.getItem(FILTER_KEY);
    if (!raw) return { statuses: [], since: "", until: "" };
    const parsed = JSON.parse(raw) as Partial<{ statuses: string[]; since: string; until: string }>;
    return {
      statuses: Array.isArray(parsed.statuses) ? parsed.statuses : [],
      since: typeof parsed.since === "string" ? parsed.since : "",
      until: typeof parsed.until === "string" ? parsed.until : "",
    };
  } catch {
    return { statuses: [], since: "", until: "" };
  }
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "ok"
      ? "bg-emerald-100 text-emerald-800"
      : status === "partial"
        ? "bg-amber-100 text-amber-800"
        : "bg-rose-100 text-rose-800";
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>
  );
}

export default function DailyBatchPage() {
  const { accessToken } = useAuth();
  const [data, setData] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState(loadInitialFilters());

  useSyncFiltersToUrl({
    status: filters.statuses,
    since: filters.since,
    until: filters.until,
  });

  // Persist filters to localStorage so they survive a refresh.
  useEffect(() => {
    try {
      window.localStorage.setItem(FILTER_KEY, JSON.stringify(filters));
    } catch {
      /* ignore */
    }
  }, [filters]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.statuses.length > 0) params.set("status", filters.statuses.join(","));
    if (filters.since) params.set("since", new Date(filters.since).toISOString());
    if (filters.until) params.set("until", new Date(filters.until).toISOString());
    return params.toString();
  }, [filters]);

  const load = useCallback(() => {
    if (!accessToken) return;
    fetch(`/api/billing/admin/daily-jobs/status${queryString ? `?${queryString}` : ""}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [accessToken, queryString]);
  useEffect(load, [load]);

  function toggleStatus(s: string) {
    setFilters((f) => ({
      ...f,
      statuses: f.statuses.includes(s) ? f.statuses.filter((x) => x !== s) : [...f.statuses, s],
    }));
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Daily Batch Leader</h1>
        <p className="text-sm text-gray-600">
          Most-recent run plus the last 30 ticks of the billing daily expiry-reminders job.
        </p>
      </header>

      {error && <p className="text-rose-600 mb-3">Error: {error}</p>}

      {data?.latest && (
        <section className="mb-6 p-4 border rounded-lg bg-white">
          <h2 className="font-semibold mb-2">Most recent</h2>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <dt className="text-xs text-gray-500">Replica</dt>
              <dd className="font-mono">{data.latest.lastReplicaId ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Status</dt>
              <dd>{data.latest.lastStatus && <StatusBadge status={data.latest.lastStatus} />}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Sent</dt>
              <dd>{data.latest.lastSent ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Failed</dt>
              <dd>{data.latest.lastFailed ?? "—"}</dd>
            </div>
            <div className="md:col-span-2">
              <dt className="text-xs text-gray-500">Last started</dt>
              <dd>
                {data.latest.lastRunAt ? new Date(data.latest.lastRunAt).toLocaleString() : "—"}
              </dd>
            </div>
            <div className="md:col-span-2">
              <dt className="text-xs text-gray-500">Last finished</dt>
              <dd>
                {data.latest.lastFinishedAt
                  ? new Date(data.latest.lastFinishedAt).toLocaleString()
                  : "—"}
              </dd>
            </div>
            {data.latest.lastError && (
              <div className="md:col-span-4">
                <dt className="text-xs text-gray-500">Last error</dt>
                <dd className="text-rose-700 whitespace-pre-wrap break-all">
                  {data.latest.lastError}
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}

      <section className="mb-4 p-3 border rounded-lg bg-gray-50">
        <h2 className="font-semibold text-sm mb-2">Filters</h2>
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <div>
            <span className="block text-xs text-gray-600 mb-1">Status</span>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map((s) => (
                <label key={s} className="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={filters.statuses.includes(s)}
                    onChange={() => toggleStatus(s)}
                  />
                  <span>{s}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="daily-batch-from" className="block text-xs text-gray-600 mb-1">
              From
            </label>
            <input
              id="daily-batch-from"
              type="datetime-local"
              value={filters.since}
              onChange={(e) => setFilters((f) => ({ ...f, since: e.target.value }))}
              className="border rounded px-2 py-1"
            />
          </div>
          <div>
            <label htmlFor="daily-batch-to" className="block text-xs text-gray-600 mb-1">
              To
            </label>
            <input
              id="daily-batch-to"
              type="datetime-local"
              value={filters.until}
              onChange={(e) => setFilters((f) => ({ ...f, until: e.target.value }))}
              className="border rounded px-2 py-1"
            />
          </div>
          <button
            type="button"
            className="ml-auto px-3 py-1 border rounded bg-white hover:bg-gray-100"
            onClick={() => setFilters({ statuses: [], since: "", until: "" })}
          >
            Reset
          </button>
          <a
            href={`/api/billing/admin/daily-jobs/history.csv${queryString ? `?${queryString}` : ""}`}
            className="px-3 py-1 border rounded bg-white hover:bg-gray-100"
          >
            Export CSV
          </a>
        </div>
      </section>

      <section className="border rounded-lg overflow-hidden bg-white">
        <table className="w-full text-sm" data-testid="recent-runs-table">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-3 py-2">Started</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Sent</th>
              <th className="px-3 py-2">Failed</th>
              <th className="px-3 py-2">Duration</th>
              <th className="px-3 py-2">Replica</th>
              <th className="px-3 py-2">Error</th>
            </tr>
          </thead>
          <tbody>
            {!data && (
              <tr>
                <td colSpan={7} className="px-3 py-3 text-gray-500">
                  Loading…
                </td>
              </tr>
            )}
            {data?.history.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-3 text-gray-500">
                  No runs match these filters.
                </td>
              </tr>
            )}
            {data?.history.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-3 py-2 font-mono text-xs">
                  {new Date(row.runAt).toLocaleString()}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-3 py-2">{row.sent ?? "—"}</td>
                <td className="px-3 py-2">{row.failed ?? "—"}</td>
                <td className="px-3 py-2">
                  {row.durationMs != null ? `${row.durationMs}ms` : "—"}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{row.replicaId ?? "—"}</td>
                <td className="px-3 py-2 text-rose-700 break-all">{row.error ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
