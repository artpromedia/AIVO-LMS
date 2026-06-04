"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { ImpersonationSession } from "@/lib/services/impersonation-svc";

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Filterable View-As audit log. Filters client-side across all text columns. */
export function ImpersonationHistoryTable({ sessions }: { sessions: ImpersonationSession[] }) {
  const [filter, setFilter] = React.useState("");

  const rows = React.useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) =>
      [s.actorName, s.actorId, s.subjectName, s.subjectId, s.subjectRole, s.reason, s.basis, s.ip]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [sessions, filter]);

  return (
    <div className="flex flex-col gap-3">
      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter by actor, subject, reason, IP…"
        className="h-10 w-full max-w-sm rounded-iw-card border border-iw-border bg-iw-raised px-3 text-sm text-iw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring"
        aria-label="Filter View-As log"
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No View-As sessions"
          description={
            sessions.length === 0
              ? "No impersonation sessions have been recorded."
              : "No sessions match your filter."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-iw-card border border-iw-border">
          <table className="w-full text-sm">
            <thead className="bg-iw-card-soft text-xs uppercase tracking-wide text-iw-ink-muted">
              <tr>
                <th className="px-4 py-3 text-left">Actor</th>
                <th className="px-4 py-3 text-left">Subject</th>
                <th className="px-4 py-3 text-left">Reason</th>
                <th className="px-4 py-3 text-left">Basis</th>
                <th className="px-4 py-3 text-left">Started</th>
                <th className="px-4 py-3 text-left">Ended</th>
                <th className="px-4 py-3 text-left">Writes</th>
                <th className="px-4 py-3 text-left">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-iw-border">
              {rows.map((s) => (
                <tr key={s.id} className="hover:bg-iw-card-soft/40">
                  <td className="px-4 py-3">
                    <span className="font-medium text-iw-ink">{s.actorName ?? s.actorId}</span>
                    {s.actorRole ? (
                      <span className="block text-xs text-iw-ink-muted">{s.actorRole}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-iw-ink">{s.subjectName ?? s.subjectId}</span>
                    {s.subjectRole ? (
                      <span className="block text-xs text-iw-ink-muted">{s.subjectRole}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate text-iw-ink-muted" title={s.reason}>
                    {s.reason || "—"}
                  </td>
                  <td className="px-4 py-3 text-iw-ink-muted">{s.basis ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-iw-ink-muted">{fmt(s.startedAt)}</td>
                  <td className="px-4 py-3 text-xs text-iw-ink-muted">{fmt(s.endedAt)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={s.allowWrites ? "danger" : "neutral"}>
                      {s.allowWrites ? "writes" : "read-only"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-iw-ink-muted">{s.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
