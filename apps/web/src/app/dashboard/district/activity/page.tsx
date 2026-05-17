"use client";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState, useCallback } from "react";
import Pagination from "@/components/Pagination";
import { IconWell } from "@/components/discovery/_vi";
import { Activity as ActivityIcon, ScrollText, School, UserCog, Ban, Home, Settings, ClipboardList, Target, FileEdit, type LucideIcon } from "lucide-react";

interface Activity {
  id: string;
  action: string;
  actorName: string;
  resourceType: string;
  resourceId?: string;
  details?: any;
  createdAt: string;
}

const PAGE_SIZE = 30;

const ACTION_ICONS: Record<string, LucideIcon> = {
  "school.created": School,
  "school.updated": School,
  "staff.invited": UserCog,
  "staff.updated": UserCog,
  "staff.deactivated": Ban,
  "classroom.created": Home,
  "settings.updated": Settings,
  "iep.created": ClipboardList,
  "intervention.created": Target,
};

export default function DistrictActivityPage() {
  const { accessToken } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const loadActivity = useCallback(() => {
    if (!accessToken) return;
    setLoading(true);
    const params = new URLSearchParams({ page: String(currentPage), pageSize: String(PAGE_SIZE) });
    fetch(`/api/district/activity?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.ok ? r.json() : { activities: [], total: 0 })
      .then((data) => { setActivities(data.activities || []); setTotal(data.total || 0); })
      .catch(() => { setActivities([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [accessToken, currentPage]);

  useEffect(() => { loadActivity(); }, [loadActivity]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-8 space-y-6">
      <header className="flex items-center gap-4">
        <IconWell color="primary">
          <ActivityIcon size={28} strokeWidth={2.5} aria-hidden="true" />
        </IconWell>
        <div>
          <h1 className="text-2xl font-heading font-bold vi-text">Activity Log</h1>
          <p className="text-sm vi-text-muted mt-1">Track all administrative actions across your district.</p>
        </div>
      </header>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-14 bg-slate-200 rounded-xl" />)}
        </div>
      ) : activities.length === 0 ? (
        <div className="vi-card p-12 text-center">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]">
            <ScrollText size={28} strokeWidth={2.5} aria-hidden="true" />
          </div>
          <p className="vi-text-muted font-medium">No activity recorded yet</p>
          <p className="text-sm vi-text-muted mt-1">Administrative actions will be logged here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((a) => {
            const RowIcon = ACTION_ICONS[a.action] || FileEdit;
            return (
            <div key={a.id} className="vi-card !rounded-xl p-4 flex items-start gap-4">
              <div className="w-10 h-10 vi-surface-soft rounded-xl flex items-center justify-center text-[hsl(var(--visual-primary))] flex-shrink-0">
                <RowIcon size={20} strokeWidth={2.5} aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium vi-text">{a.actorName}</span>
                  <span className="vi-text-muted text-xs">{a.action?.replace(/\./g, " ")}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="px-2 py-0.5 text-xs rounded-full vi-surface-soft vi-text-muted font-medium">
                    {a.resourceType}
                  </span>
                  {a.details && typeof a.details === "object" && (
                    <span className="text-xs vi-text-muted truncate">
                      {Object.entries(a.details).map(([k, v]) => `${k}: ${v}`).join(", ")}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-xs vi-text-muted flex-shrink-0">
                {new Date(a.createdAt).toLocaleString()}
              </span>
            </div>
            );
          })}
          {totalPages > 1 && (
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={total} pageSize={PAGE_SIZE} />
          )}
        </div>
      )}
    </div>
  );
}
