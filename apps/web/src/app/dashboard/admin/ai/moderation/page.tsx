"use client";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import {
  readParamString,
  readWindowSearchParams,
  useSyncFiltersToUrl,
} from "@/hooks/use-url-filters";

interface ModerationItem {
  id: string;
  content: string;
  contentType: string;
  flagReason: string;
  flagConfidence: string | number | null;
  tutorSku: string | null;
  modelUsed: string | null;
  status: string;
  reviewNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

interface StatsResponse {
  byStatus: { status: string; count: number }[];
  byReason: { reason: string; count: number }[];
  byTutor: { tutor: string; count: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]",
  APPROVED: "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]",
  REJECTED: "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]",
  ESCALATED: "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]",
  LOW_CONFIDENCE: "bg-slate-100 text-slate-700",
};

const FILTERS = ["ALL", "PENDING", "APPROVED", "REJECTED", "ESCALATED", "LOW_CONFIDENCE"];

export default function ContentModerationPage() {
  const { accessToken } = useAuth();
  const initialParams = useMemo(() => readWindowSearchParams(), []);
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [filter, setFilter] = useState(() => readParamString(initialParams, "status", "ALL"));
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useSyncFiltersToUrl({ status: filter === "ALL" ? undefined : filter });
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const qs = filter === "ALL" ? "" : `?status=${filter}`;
      const [listRes, statsRes] = await Promise.all([
        fetch(`/api/admin-svc/moderation${qs}`, { headers: { Authorization: `Bearer ${accessToken}` } }),
        fetch(`/api/admin-svc/moderation/stats`, { headers: { Authorization: `Bearer ${accessToken}` } }),
      ]);
      if (!listRes.ok) throw new Error(`List failed: ${listRes.status}`);
      const listJson = await listRes.json();
      setItems(listJson.items || []);
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (e: any) {
      setError(e.message || "Failed to load moderation queue");
    } finally {
      setLoading(false);
    }
  }, [accessToken, filter]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  useEffect(() => {
    const i = setInterval(fetchItems, 30000);
    return () => clearInterval(i);
  }, [fetchItems]);

  const handleAction = async (id: string, status: string) => {
    if (!accessToken) return;
    const reviewNotes = notesDraft[id] || "";
    const res = await fetch(`/api/admin-svc/moderation/${id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status, reviewNotes }),
    });
    if (res.ok) {
      const updated = await res.json();
      setItems((prev) => prev.map((it) => it.id === id ? updated : it));
      setNotesDraft((d) => { const next = { ...d }; delete next[id]; return next; });
      fetchItems();
    } else {
      setError(`Action failed: ${res.status}`);
    }
  };

  const statCount = (key: string) => stats?.byStatus.find((s) => s.status === key)?.count ?? 0;
  const totalCount = stats?.byStatus.reduce((a, s) => a + s.count, 0) ?? 0;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3 text-sm vi-text-muted">
        <Link href="/dashboard/admin/ai" className="hover:text-[hsl(var(--visual-primary))] transition">AI &amp; Brain Models</Link>
        <span>/</span>
        <span className="vi-text font-medium">Content Moderation</span>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold vi-text">Content Moderation</h1>
          <p className="text-sm vi-text-muted mt-1">Review AI-generated content flagged by automated safety filters.</p>
        </div>
        <button
          onClick={fetchItems}
          disabled={loading}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[hsl(var(--visual-primary)/0.1)] text-[hsl(var(--visual-primary))] hover:bg-[hsl(var(--visual-primary)/0.18)] border border-[hsl(var(--visual-primary)/0.25)] transition disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: "Pending", value: statCount("PENDING"), color: "text-[hsl(var(--visual-sel))]" },
          { label: "Approved", value: statCount("APPROVED"), color: "text-[hsl(var(--visual-science))]" },
          { label: "Rejected", value: statCount("REJECTED"), color: "text-[hsl(var(--visual-math))]" },
          { label: "Escalated", value: statCount("ESCALATED"), color: "text-[hsl(var(--visual-primary))]" },
          { label: "Total Flagged", value: totalCount, color: "vi-text" },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-xl p-4 shadow-sm border vi-border text-center">
            <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
            <p className="text-xs vi-text-muted font-semibold mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="vi-card overflow-hidden">
        <div className="p-4 border-b vi-border flex items-center gap-3 flex-wrap">
          <span className="text-sm vi-text-muted">Filter:</span>
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                filter === f ? "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]" : "vi-bg vi-text-muted hover:vi-surface-soft"
              }`}
            >
              {f.charAt(0) + f.slice(1).toLowerCase().replace("_", " ")}
            </button>
          ))}
        </div>

        <div className="divide-y divide-slate-50">
          {items.map((item) => {
            const conf = typeof item.flagConfidence === "string" ? parseFloat(item.flagConfidence) : (item.flagConfidence || 0);
            return (
              <div key={item.id} className="p-5 hover:vi-bg/50 transition">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`px-2.5 py-0.5 text-xs rounded-full font-semibold ${STATUS_COLORS[item.status] || "bg-slate-100 text-slate-700"}`}>{item.status}</span>
                      <span className="text-xs vi-surface-soft vi-text-muted px-2 py-0.5 rounded-full">{item.flagReason.replace(/_/g, " ")}</span>
                      <span className="text-xs vi-text-muted">Confidence: {(conf * 100).toFixed(0)}%</span>
                    </div>
                    <p className="text-sm vi-text line-clamp-2">{item.content}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs vi-text-muted flex-wrap">
                      <span>Tutor: {item.tutorSku || "—"}</span>
                      <span>Model: {item.modelUsed || "—"}</span>
                      <span>{new Date(item.createdAt).toLocaleString()}</span>
                      {item.reviewedAt && <span>Reviewed {new Date(item.reviewedAt).toLocaleString()}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg vi-bg vi-text-muted hover:vi-surface-soft border vi-border transition"
                    >
                      {expandedId === item.id ? "Collapse" : "Review"}
                    </button>
                  </div>
                </div>

                {expandedId === item.id && (
                  <div className="mt-4 p-4 vi-bg rounded-xl border vi-border space-y-3">
                    <div>
                      <p className="text-xs font-semibold vi-text-muted mb-1">Full content</p>
                      <p className="text-sm vi-text whitespace-pre-wrap">{item.content}</p>
                    </div>
                    {item.reviewNotes && (
                      <div>
                        <p className="text-xs font-semibold vi-text-muted mb-1">Existing review notes</p>
                        <p className="text-sm vi-text whitespace-pre-wrap">{item.reviewNotes}</p>
                      </div>
                    )}
                    <div>
                      <label className="text-xs font-semibold vi-text-muted block mb-1" htmlFor={`notes-${item.id}`}>Add review notes</label>
                      <textarea
                        id={`notes-${item.id}`}
                        rows={3}
                        value={notesDraft[item.id] ?? ""}
                        onChange={(e) => setNotesDraft((d) => ({ ...d, [item.id]: e.target.value }))}
                        className="w-full text-sm rounded-lg border vi-border p-2 bg-white"
                        placeholder="Why are you approving / rejecting / escalating this item?"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAction(item.id, "APPROVED")}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[hsl(var(--visual-science)/0.08)] text-[hsl(var(--visual-science))] hover:bg-[hsl(var(--visual-science)/0.14)] border border-[hsl(var(--visual-science)/0.25)] transition"
                      >Approve</button>
                      <button
                        onClick={() => handleAction(item.id, "REJECTED")}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[hsl(var(--visual-math)/0.08)] text-[hsl(var(--visual-math))] hover:bg-[hsl(var(--visual-math)/0.12)] border border-[hsl(var(--visual-math)/0.25)] transition"
                      >Reject</button>
                      <button
                        onClick={() => handleAction(item.id, "ESCALATED")}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[hsl(var(--visual-primary)/0.08)] text-[hsl(var(--visual-primary))] hover:bg-[hsl(var(--visual-primary)/0.14)] border border-[hsl(var(--visual-primary)/0.25)] transition"
                      >Escalate</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {items.length === 0 && !loading && (
            <div className="p-10 text-center vi-text-muted">No moderation items match the current filter.</div>
          )}
          {loading && items.length === 0 && (
            <div className="p-10 text-center vi-text-muted">Loading…</div>
          )}
        </div>
      </div>
    </div>
  );
}
