"use client";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

const ROLE_COLORS: Record<string, string> = {
  TEACHER: "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]",
  THERAPIST: "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]",
  CAREGIVER: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]",
  DISTRICT_ADMIN: "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]",
};

export default function StaffDetailPage() {
  const { accessToken } = useAuth();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken || !id) return;
    fetch(`/api/district/staff/${id}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken, id]);

  if (loading) {
    return (
      <div className="p-8 animate-pulse space-y-4">
        <div className="h-8 bg-slate-200 rounded-lg w-64" />
        <div className="h-64 bg-slate-200 rounded-2xl" />
      </div>
    );
  }

  if (!data?.user) {
    return (
      <div className="p-8">
        <p className="vi-text-muted">Staff member not found.</p>
        <Link href="/dashboard/district/staff" className="text-[hsl(var(--visual-primary))] text-sm mt-2 inline-block">Back to Staff</Link>
      </div>
    );
  }

  const u = data.user;

  return (
    <div className="p-8 space-y-6">
      <header>
        <Link href="/dashboard/district/staff" className="text-sm text-[hsl(var(--visual-primary))] hover:underline mb-2 inline-block">&larr; Back to Staff</Link>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[hsl(var(--visual-science)/0.85)] to-[hsl(var(--visual-science))] flex items-center justify-center text-white text-xl font-bold">
            {u.name?.charAt(0) || "?"}
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold vi-text">{u.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`px-2.5 py-0.5 text-xs rounded-full font-semibold ${ROLE_COLORS[u.role] || "vi-surface-soft vi-text-muted"}`}>
                {u.role?.replace(/_/g, " ")}
              </span>
              {u.deactivatedAt && (
                <span className="px-2.5 py-0.5 text-xs rounded-full font-semibold bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]">Deactivated</span>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="vi-card p-6 space-y-3">
          <h3 className="text-lg font-semibold vi-text">Profile</h3>
          <InfoRow label="Name" value={u.name || "—"} />
          <InfoRow label="Email" value={u.email || "—"} />
          <InfoRow label="Role" value={u.role?.replace(/_/g, " ") || "—"} />
          <InfoRow label="Joined" value={u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"} />
          <InfoRow label="Last Login" value={u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "Never"} />
        </div>

        <div className="vi-card p-6 space-y-3">
          <h3 className="text-lg font-semibold vi-text">School Assignments</h3>
          {data.schoolAssignments?.length > 0 ? (
            <div className="space-y-2">
              {data.schoolAssignments.map((a: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg vi-bg">
                  <Link href={`/dashboard/district/schools/${a.schoolId}`} className="text-sm font-medium text-[hsl(var(--visual-primary))] hover:underline">
                    {a.schoolName}
                  </Link>
                  <div className="flex items-center gap-2">
                    {a.roleAtSchool && <span className="text-xs vi-text-muted">{a.roleAtSchool}</span>}
                    <span className="text-xs vi-text-muted">{a.assignedAt ? new Date(a.assignedAt).toLocaleDateString() : ""}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm vi-text-muted">No school assignments.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg vi-bg">
      <span className="text-xs vi-text-muted font-medium w-24">{label}</span>
      <span className="text-sm vi-text">{value}</span>
    </div>
  );
}
