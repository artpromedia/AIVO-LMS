"use client";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import Pagination from "@/components/Pagination";
import { IconWell } from "@/components/discovery/_vi";
import { ScrollText } from "lucide-react";
import {
  readParamNumber,
  readParamString,
  readWindowSearchParams,
  useSyncFiltersToUrl,
} from "@/hooks/use-url-filters";

interface AuditEntry {
  id: string;
  action: string;
  actorEmail: string;
  actorRole: string;
  onBehalfOfId: string | null;
  resourceType: string;
  resourceId: string;
  details: Record<string, unknown> | null;
  ipAddress: string;
  createdAt: string;
}

interface ChainSummary {
  table: string;
  totalRows: number;
  chainStartSeq: number | null;
  lastVerifiedSeq: number | null;
  brokenAtSeq: number | null;
  ok: boolean;
}

interface AuditResponse {
  entries: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export default function AuditLogPage() {
  const { accessToken } = useAuth();
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [chainStatus, setChainStatus] = useState<{ ok: boolean; chains: ChainSummary[] } | null>(null);

  const initial = useMemo(() => readWindowSearchParams(), []);
  const [search, setSearch] = useState(() => readParamString(initial, "search"));
  const [action, setAction] = useState(() => readParamString(initial, "action"));
  const [resourceType, setResourceType] = useState(() => readParamString(initial, "resourceType"));
  const [from, setFrom] = useState(() => readParamString(initial, "from"));
  const [to, setTo] = useState(() => readParamString(initial, "to"));
  const [page, setPage] = useState(() => readParamNumber(initial, "page", 1));
  const pageSize = 50;

  useSyncFiltersToUrl({ search, action, resourceType, from, to, page: page === 1 ? undefined : page });

  const fetchData = useCallback(() => {
    if (!accessToken) return;
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (search) params.set("search", search);
    if (action) params.set("action", action);
    if (resourceType) params.set("resourceType", resourceType);
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    fetch(`/api/admin-svc/audit-log?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken, page, search, action, resourceType, from, to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!accessToken) return;
    fetch("/api/admin-svc/audit-log/verify", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setChainStatus(d))
      .catch(() => {});
  }, [accessToken]);

  const clearFilters = () => {
    setSearch("");
    setAction("");
    setResourceType("");
    setFrom("");
    setTo("");
    setPage(1);
  };

  const handleExport = () => {
    if (!data || data.entries.length === 0) return;
    const headers = ["Timestamp", "Actor", "Role", "Action", "Resource Type", "Resource ID", "IP Address"];
    const rows = data.entries.map((e) => [
      new Date(e.createdAt).toISOString(),
      e.actorEmail,
      e.actorRole,
      e.action,
      e.resourceType,
      e.resourceId,
      e.ipAddress || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/admin/compliance"
          className="text-sm text-[hsl(var(--visual-primary))] hover:text-[hsl(var(--visual-primary))] transition"
        >
          ← Back to Compliance
        </Link>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <IconWell color="science">
            <ScrollText size={28} strokeWidth={2.5} aria-hidden="true" />
          </IconWell>
          <div>
            <h1 className="text-2xl font-heading font-bold vi-text">Audit Log</h1>
            <p className="text-sm vi-text-muted mt-1">Searchable record of every admin action and security event.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {chainStatus && (
            <span
              title={chainStatus.chains.map((c) => `${c.table}: ${c.ok ? "ok" : `broken@${c.brokenAtSeq}`} (${c.totalRows} rows)`).join("\n")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full ${
                chainStatus.ok
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {chainStatus.ok ? "✓ Audit chain verified" : "⚠ Audit chain broken"}
            </span>
          )}
          <button
            onClick={handleExport}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition"
          >
            Export
          </button>
        </div>
      </div>

      <div className="vi-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm rounded-lg border vi-border vi-bg focus:outline-none focus:ring-2 focus:ring-purple-500 w-48"
          />
          <select
            value={action}
            onChange={(e) => { setAction(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm rounded-lg border vi-border vi-bg focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Actions</option>
            <option value="USER_CREATED">User Created</option>
            <option value="USER_UPDATED">User Updated</option>
            <option value="USER_DELETED">User Deleted</option>
            <option value="ROLE_ASSIGNED">Role Assigned</option>
            <option value="LOGIN">Login</option>
            <option value="LOGOUT">Logout</option>
            <option value="IMPERSONATION">Impersonation</option>
            <option value="TENANT_CREATED">Tenant Created</option>
            <option value="CONFIG_UPDATED">Config Updated</option>
          </select>
          <select
            value={resourceType}
            onChange={(e) => { setResourceType(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm rounded-lg border vi-border vi-bg focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Resources</option>
            <option value="User">User</option>
            <option value="Tenant">Tenant</option>
            <option value="Learner">Learner</option>
            <option value="Session">Session</option>
            <option value="Settings">Settings</option>
          </select>
          <input
            type="date"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm rounded-lg border vi-border vi-bg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => { setTo(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm rounded-lg border vi-border vi-bg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            onClick={clearFilters}
            className="px-3 py-2 text-sm rounded-lg border vi-border vi-text-muted hover:vi-surface-soft transition"
          >
            Clear Filters
          </button>
        </div>
      </div>

      <div className="vi-card overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 vi-surface-soft rounded animate-pulse" />
            ))}
          </div>
        ) : !data || data.entries.length === 0 ? (
          <div className="p-12 text-center vi-text-muted text-sm">No audit log entries found.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b vi-border vi-bg">
                    <th className="text-left px-4 py-3 font-semibold vi-text-muted">Timestamp</th>
                    <th className="text-left px-4 py-3 font-semibold vi-text-muted">Actor</th>
                    <th className="text-left px-4 py-3 font-semibold vi-text-muted">Action</th>
                    <th className="text-left px-4 py-3 font-semibold vi-text-muted">Resource</th>
                    <th className="text-left px-4 py-3 font-semibold vi-text-muted">IP Address</th>
                    <th className="text-left px-4 py-3 font-semibold vi-text-muted">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((entry) => (
                    <tr key={entry.id} className="border-b vi-border hover:vi-bg transition">
                      <td className="px-4 py-3 text-xs vi-text-muted whitespace-nowrap">
                        {new Date(entry.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm vi-text">{entry.actorEmail}</div>
                        <span className="px-1.5 py-0.5 text-[10px] rounded vi-surface-soft vi-text-muted font-medium">
                          {entry.actorRole.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs rounded font-semibold ${
                          entry.action.startsWith("IMPERSONATION_")
                            ? "bg-yellow-100 text-yellow-900"
                            : "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]"
                        }`}>
                          {entry.action.replace(/_/g, " ")}
                        </span>
                        {entry.onBehalfOfId && (
                          <div className="mt-1 inline-flex items-center px-2 py-0.5 text-[10px] rounded bg-yellow-50 text-yellow-800 border border-yellow-200 font-mono">
                            on behalf of {entry.onBehalfOfId.slice(0, 8)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm vi-text">{entry.resourceType}</span>
                        <span className="text-xs vi-text-muted ml-1">#{entry.resourceId}</span>
                      </td>
                      <td className="px-4 py-3 text-xs vi-text-muted font-mono">{entry.ipAddress || "—"}</td>
                      <td className="px-4 py-3">
                        {entry.details ? (
                          <button
                            onClick={() => setExpandedRow(expandedRow === entry.id ? null : entry.id)}
                            className="text-xs text-[hsl(var(--visual-primary))] hover:text-[hsl(var(--visual-primary))] font-medium transition"
                          >
                            {expandedRow === entry.id ? "Hide" : "View"}
                          </button>
                        ) : (
                          <span className="text-xs vi-text-muted opacity-70">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.entries.some((e) => expandedRow === e.id && e.details) && (
              <div className="px-4 py-3 vi-bg border-t vi-border">
                <pre className="text-xs vi-text-muted overflow-auto max-h-48 p-3 bg-white rounded-lg border vi-border">
                  {JSON.stringify(
                    data.entries.find((e) => e.id === expandedRow)?.details,
                    null,
                    2
                  )}
                </pre>
              </div>
            )}

            <Pagination
              currentPage={data.page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={data.total}
              pageSize={data.pageSize}
            />
          </>
        )}
      </div>
    </div>
  );
}
