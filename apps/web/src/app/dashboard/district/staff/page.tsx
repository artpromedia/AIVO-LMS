"use client";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Pagination from "@/components/Pagination";

interface StaffMember {
  id: string;
  name: string;
  email: string | null;
  role: string;
  createdAt: string;
  lastLoginAt?: string;
  schoolAssignments: { schoolId: string; schoolName: string; roleAtSchool?: string }[];
}

const ROLE_COLORS: Record<string, string> = {
  TEACHER: "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]",
  THERAPIST: "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]",
  CAREGIVER: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]",
  DISTRICT_ADMIN: "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]",
};

const PAGE_SIZE = 20;

export default function DistrictStaffPage() {
  const { accessToken } = useAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [total, setTotal] = useState(0);
  const [roleFilter, setRoleFilter] = useState("");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);

  const loadStaff = useCallback(() => {
    if (!accessToken) return;
    setLoading(true);
    const params = new URLSearchParams({ page: String(currentPage), pageSize: String(PAGE_SIZE) });
    if (search) params.set("search", search);
    if (roleFilter) params.set("role", roleFilter);

    fetch(`/api/district/staff?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.ok ? r.json() : { staff: [], total: 0 })
      .then((data) => { setStaff(data.staff || []); setTotal(data.total || 0); })
      .catch(() => { setStaff([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [accessToken, currentPage, search, roleFilter]);

  useEffect(() => { loadStaff(); }, [loadStaff]);
  useEffect(() => { setCurrentPage(1); }, [search, roleFilter]);

  useEffect(() => {
    if (!accessToken) return;
    fetch("/api/district/schools", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.ok ? r.json() : { schools: [] })
      .then((data) => setSchools(data.schools?.map((s: any) => ({ id: s.id, name: s.name })) || []));
  }, [accessToken]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold vi-text">Staff & Teachers</h1>
          <p className="text-sm vi-text-muted mt-1">Manage teachers, therapists, and caregivers across your district.</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 transition shadow-sm"
        >
          + Invite Staff
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2 rounded-xl border vi-border text-sm w-72 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border vi-border text-sm vi-text-muted focus:border-violet-400 outline-none"
        >
          <option value="">All Roles</option>
          <option value="TEACHER">Teachers</option>
          <option value="THERAPIST">Therapists</option>
          <option value="CAREGIVER">Caregivers</option>
          <option value="DISTRICT_ADMIN">District Admins</option>
        </select>
        <span className="text-sm vi-text-muted">{total} staff</span>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-slate-200 rounded-xl" />)}
        </div>
      ) : (
        <div className="vi-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left vi-text-muted vi-bg/50 border-b vi-border">
                <th className="px-5 py-3 font-semibold">Name</th>
                <th className="px-5 py-3 font-semibold">Email</th>
                <th className="px-5 py-3 font-semibold">Role</th>
                <th className="px-5 py-3 font-semibold">Schools</th>
                <th className="px-5 py-3 font-semibold">Last Login</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((u) => (
                <tr key={u.id} className="border-b vi-border hover:vi-surface-soft transition cursor-pointer">
                  <td className="px-5 py-3">
                    <Link href={`/dashboard/district/staff/${u.id}`} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[hsl(var(--visual-science)/0.85)] to-[hsl(var(--visual-science))] flex items-center justify-center text-white text-xs font-bold">
                        {u.name?.charAt(0) || "?"}
                      </div>
                      <span className="font-medium vi-text hover:text-[hsl(var(--visual-primary))]">{u.name}</span>
                    </Link>
                  </td>
                  <td className="px-5 py-3 vi-text-muted">{u.email || "—"}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2.5 py-0.5 text-xs rounded-full font-semibold ${ROLE_COLORS[u.role] || "vi-surface-soft vi-text-muted"}`}>
                      {u.role.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-5 py-3 vi-text-muted text-xs">
                    {u.schoolAssignments?.length ? u.schoolAssignments.map(a => a.schoolName).join(", ") : "—"}
                  </td>
                  <td className="px-5 py-3 vi-text-muted text-xs">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "Never"}
                  </td>
                </tr>
              ))}
              {staff.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-10 text-center vi-text-muted">No staff found</td></tr>
              )}
            </tbody>
          </table>
          {totalPages > 1 && (
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={total} pageSize={PAGE_SIZE} />
          )}
        </div>
      )}

      {showInvite && (
        <InviteStaffModal
          accessToken={accessToken!}
          schools={schools}
          onClose={() => setShowInvite(false)}
          onCreated={() => { setShowInvite(false); loadStaff(); }}
        />
      )}
    </div>
  );
}

function InviteStaffModal({ accessToken, schools, onClose, onCreated }: {
  accessToken: string; schools: { id: string; name: string }[]; onClose: () => void; onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("TEACHER");
  const [schoolId, setSchoolId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ temporaryPassword: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) { setError("Name and email are required"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/district/staff", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), role, schoolId: schoolId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to invite staff");
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-heading font-semibold vi-text">Invite Staff Member</h2>
          <button onClick={onClose} className="vi-text-muted hover:vi-text-muted text-xl">&times;</button>
        </div>
        {error && <p className="text-sm text-[hsl(var(--visual-math))] bg-[hsl(var(--visual-math)/0.08)] rounded-lg px-3 py-2">{error}</p>}
        {result ? (
          <div className="space-y-3">
            <div className="bg-[hsl(var(--visual-science)/0.08)] border border-[hsl(var(--visual-science)/0.25)] rounded-xl p-4">
              <p className="text-sm font-semibold text-[hsl(var(--visual-science))]">Staff member invited successfully!</p>
              <p className="text-xs text-[hsl(var(--visual-science))] mt-1">Share this temporary password with the new staff member:</p>
              <p className="mt-2 font-mono text-sm bg-white rounded-lg px-3 py-2 border border-[hsl(var(--visual-science)/0.25)] select-all">{result.temporaryPassword}</p>
            </div>
            <button onClick={onCreated} className="w-full px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700">Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="staff-name" className="text-xs vi-text-muted font-medium">Full Name *</label>
              <input id="staff-name" type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 rounded-xl border vi-border text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none" />
            </div>
            <div className="space-y-1">
              <label htmlFor="staff-email" className="text-xs vi-text-muted font-medium">Email *</label>
              <input id="staff-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 rounded-xl border vi-border text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="staff-role" className="text-xs vi-text-muted font-medium">Role *</label>
                <select id="staff-role" value={role} onChange={(e) => setRole(e.target.value)} className="w-full px-3 py-2 rounded-xl border vi-border text-sm focus:border-violet-400 outline-none">
                  <option value="TEACHER">Teacher</option>
                  <option value="THERAPIST">Therapist</option>
                  <option value="CAREGIVER">Caregiver</option>
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="staff-school" className="text-xs vi-text-muted font-medium">Assign to School</label>
                <select id="staff-school" value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className="w-full px-3 py-2 rounded-xl border vi-border text-sm focus:border-violet-400 outline-none">
                  <option value="">No assignment</option>
                  {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border vi-border rounded-xl text-sm vi-text-muted hover:vi-bg">Cancel</button>
              <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
                {saving ? "Inviting..." : "Send Invite"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
