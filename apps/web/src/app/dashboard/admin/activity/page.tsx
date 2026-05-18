"use client";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState } from "react";
import Link from "next/link";

interface ActivityEntry {
  id: string;
  action: string;
  actorEmail: string;
  actorRole: string;
  resourceType: string;
  resourceId: string;
  details: Record<string, unknown> | null;
  createdAt: string;
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function resourceLink(type: string, id: string): string | null {
  const map: Record<string, string> = {
    User: `/dashboard/admin/users/${id}`,
    Learner: `/dashboard/admin/learners/${id}`,
    Tenant: `/dashboard/admin/tenants/${id}`,
  };
  return map[type] || null;
}

const ACTION_COLORS: Record<string, string> = {
  USER_CREATED: "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]",
  USER_UPDATED: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]",
  USER_DELETED: "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]",
  ROLE_ASSIGNED: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]",
  TENANT_CREATED: "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]",
  LOGIN: "vi-surface-soft vi-text",
  LOGOUT: "vi-surface-soft vi-text",
  IMPERSONATION: "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]",
  CONFIG_UPDATED: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]",
};

export default function ActivityFeedPage() {
  const { accessToken } = useAuth();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    fetch("/api/admin-svc/activity", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setEntries(Array.isArray(data) ? data.slice(0, 20) : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken]);

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-8 bg-slate-200 rounded-lg w-48 animate-pulse" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 bg-slate-200 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-heading font-bold vi-text">Activity Feed</h1>

      {entries.length === 0 ? (
        <div className="vi-card p-12 text-center vi-text-muted text-sm">No recent activity.</div>
      ) : (
        <div className="vi-card p-6">
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 vi-surface-soft" />
            <div className="space-y-6">
              {entries.map((entry) => (
                <div key={entry.id} className="relative pl-10">
                  <div className="absolute left-2.5 top-1.5 w-3 h-3 rounded-full bg-[hsl(var(--visual-primary))] border-2 border-white shadow-sm" />
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium vi-text">{entry.actorEmail}</span>
                        <span
                          className={`px-2 py-0.5 text-[10px] rounded font-semibold ${ACTION_COLORS[entry.action] || "vi-surface-soft vi-text-muted"}`}
                        >
                          {entry.action.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {resourceLink(entry.resourceType, entry.resourceId) ? (
                          <Link
                            href={resourceLink(entry.resourceType, entry.resourceId)!}
                            className="text-xs text-[hsl(var(--visual-primary))] hover:text-[hsl(var(--visual-primary))] transition"
                          >
                            {entry.resourceType} #{entry.resourceId}
                          </Link>
                        ) : (
                          <span className="text-xs vi-text-muted">
                            {entry.resourceType} #{entry.resourceId}
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 text-[10px] rounded vi-surface-soft vi-text-muted font-medium">
                          {entry.actorRole.replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs vi-text-muted whitespace-nowrap flex-shrink-0">
                      {formatTimeAgo(new Date(entry.createdAt))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
