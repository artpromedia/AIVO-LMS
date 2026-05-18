"use client";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Intervention {
  id: string;
  type: string;
  tier: number;
  description?: string;
  startDate: string;
  endDate?: string;
  status: string;
  createdAt: string;
  learnerId: string;
  learnerName: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]",
  completed: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]",
  paused: "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]",
  cancelled: "vi-surface-soft vi-text-muted",
};

export default function DistrictInterventionsPage() {
  const { accessToken } = useAuth();
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    const qs = statusFilter ? `?status=${statusFilter}` : "";
    fetch(`/api/district/interventions${qs}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : { interventions: [] }))
      .then((data) => setInterventions(data.interventions || []))
      .catch(() => setInterventions([]))
      .finally(() => setLoading(false));
  }, [accessToken, statusFilter]);

  const tierCounts = [1, 2, 3].map((tier) => ({
    tier,
    count: interventions.filter((i) => i.tier === tier).length,
  }));

  return (
    <div className="p-8 space-y-6">
      <header>
        <h1 className="text-2xl font-heading font-bold vi-text">Interventions</h1>
        <p className="text-sm vi-text-muted mt-1">
          Track academic and behavioral interventions across the district.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        {tierCounts.map(({ tier, count }) => (
          <div key={tier} className="vi-card p-5 text-center">
            <p className="text-xs vi-text-muted font-medium uppercase">Tier {tier}</p>
            <p className="text-3xl font-bold vi-text mt-1">{count}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border vi-border text-sm vi-text-muted focus:border-violet-400 outline-none"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="paused">Paused</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <span className="text-sm vi-text-muted">{interventions.length} interventions</span>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-slate-200 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="vi-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left vi-text-muted vi-bg/50 border-b vi-border">
                <th className="px-5 py-3 font-semibold">Learner</th>
                <th className="px-5 py-3 font-semibold">Type</th>
                <th className="px-5 py-3 font-semibold">Tier</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Start</th>
                <th className="px-5 py-3 font-semibold">End</th>
              </tr>
            </thead>
            <tbody>
              {interventions.map((iv) => (
                <tr key={iv.id} className="border-b vi-border hover:vi-surface-soft transition">
                  <td className="px-5 py-3">
                    <Link
                      href={`/dashboard/district/learners/${iv.learnerId}`}
                      className="font-medium vi-text hover:text-[hsl(var(--visual-primary))]"
                    >
                      {iv.learnerName}
                    </Link>
                  </td>
                  <td className="px-5 py-3 vi-text-muted">{iv.type}</td>
                  <td className="px-5 py-3">
                    <span className="px-2 py-0.5 text-xs rounded-full bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))] font-semibold">
                      Tier {iv.tier}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`px-2.5 py-0.5 text-xs rounded-full font-semibold ${STATUS_COLORS[iv.status] || "vi-surface-soft vi-text-muted"}`}
                    >
                      {iv.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 vi-text-muted text-xs">{iv.startDate || "—"}</td>
                  <td className="px-5 py-3 vi-text-muted text-xs">{iv.endDate || "Ongoing"}</td>
                </tr>
              ))}
              {interventions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center vi-text-muted">
                    No interventions found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
