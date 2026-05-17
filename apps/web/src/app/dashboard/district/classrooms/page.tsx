"use client";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState } from "react";
import { IconWell } from "@/components/discovery/_vi";
import { Home, Plus } from "lucide-react";

interface Classroom {
  id: string;
  name: string;
  gradeLevel?: string;
  subject?: string;
  capacity?: number;
  schoolId: string;
  schoolName?: string;
  createdAt: string;
}

export default function DistrictClassroomsPage() {
  const { accessToken } = useAuth();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [schoolFilter, setSchoolFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const loadClassrooms = () => {
    if (!accessToken) return;
    const qs = schoolFilter ? `?schoolId=${schoolFilter}` : "";
    fetch(`/api/district/classrooms${qs}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.ok ? r.json() : { classrooms: [] })
      .then((data) => setClassrooms(data.classrooms || []))
      .catch(() => setClassrooms([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadClassrooms(); }, [accessToken, schoolFilter]);

  useEffect(() => {
    if (!accessToken) return;
    fetch("/api/district/schools", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.ok ? r.json() : { schools: [] })
      .then((data) => setSchools(data.schools?.map((s: any) => ({ id: s.id, name: s.name })) || []));
  }, [accessToken]);

  return (
    <div className="p-8 space-y-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <IconWell color="primary">
            <Home size={28} strokeWidth={2.5} aria-hidden="true" />
          </IconWell>
          <div>
            <h1 className="text-2xl font-heading font-bold vi-text">Classrooms</h1>
            <p className="text-sm vi-text-muted mt-1">Manage classroom assignments across all schools.</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 transition shadow-sm flex items-center gap-2"
        >
          <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
          Add Classroom
        </button>
      </header>

      <div className="flex items-center gap-3">
        <select
          value={schoolFilter}
          onChange={(e) => setSchoolFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border vi-border text-sm vi-text-muted focus:border-violet-400 outline-none"
        >
          <option value="">All Schools</option>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <span className="text-sm vi-text-muted">{classrooms.length} classrooms</span>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-slate-200 rounded-xl" />)}
        </div>
      ) : classrooms.length === 0 ? (
        <div className="vi-card p-12 text-center">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]">
            <Home size={28} strokeWidth={2.5} aria-hidden="true" />
          </div>
          <p className="vi-text-muted font-medium">No classrooms found</p>
          <p className="text-sm vi-text-muted mt-1">Create classrooms and assign them to schools.</p>
        </div>
      ) : (
        <div className="vi-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left vi-text-muted vi-bg/50 border-b vi-border">
                <th className="px-5 py-3 font-semibold">Classroom</th>
                <th className="px-5 py-3 font-semibold">School</th>
                <th className="px-5 py-3 font-semibold">Grade</th>
                <th className="px-5 py-3 font-semibold">Subject</th>
                <th className="px-5 py-3 font-semibold">Capacity</th>
              </tr>
            </thead>
            <tbody>
              {classrooms.map((c) => (
                <tr key={c.id} className="border-b vi-border hover:vi-surface-soft transition">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))] rounded-lg flex items-center justify-center"><Home size={16} strokeWidth={2.5} aria-hidden="true" /></div>
                      <span className="font-medium vi-text">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 vi-text-muted text-xs">{c.schoolName || "—"}</td>
                  <td className="px-5 py-3 vi-text-muted">{c.gradeLevel || "—"}</td>
                  <td className="px-5 py-3 vi-text-muted">{c.subject || "—"}</td>
                  <td className="px-5 py-3 vi-text-muted">{c.capacity || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateClassroomModal
          accessToken={accessToken!}
          schools={schools}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadClassrooms(); }}
        />
      )}
    </div>
  );
}

function CreateClassroomModal({ accessToken, schools, onClose, onCreated }: {
  accessToken: string; schools: { id: string; name: string }[]; onClose: () => void; onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [schoolId, setSchoolId] = useState(schools[0]?.id || "");
  const [gradeLevel, setGradeLevel] = useState("");
  const [subject, setSubject] = useState("");
  const [capacity, setCapacity] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !schoolId) { setError("Classroom name and school are required"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/district/classrooms", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId, name: name.trim(),
          gradeLevel: gradeLevel.trim() || undefined,
          subject: subject.trim() || undefined,
          capacity: capacity ? parseInt(capacity) : undefined,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed to create classroom"); }
      onCreated();
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
          <h2 className="text-lg font-heading font-semibold vi-text">Add Classroom</h2>
          <button onClick={onClose} className="vi-text-muted hover:vi-text-muted text-xl">&times;</button>
        </div>
        {error && <p className="text-sm text-[hsl(var(--visual-math))] bg-[hsl(var(--visual-math)/0.08)] rounded-lg px-3 py-2">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="classroom-name" className="text-xs vi-text-muted font-medium">Classroom Name *</label>
            <input id="classroom-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Room 101" className="w-full px-3 py-2 rounded-xl border vi-border text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none" />
          </div>
          <div className="space-y-1">
            <label htmlFor="classroom-school" className="text-xs vi-text-muted font-medium">School *</label>
            <select id="classroom-school" value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className="w-full px-3 py-2 rounded-xl border vi-border text-sm focus:border-violet-400 outline-none">
              {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label htmlFor="classroom-grade" className="text-xs vi-text-muted font-medium">Grade</label>
              <input id="classroom-grade" type="text" value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} className="w-full px-3 py-2 rounded-xl border vi-border text-sm focus:border-violet-400 outline-none" />
            </div>
            <div className="space-y-1">
              <label htmlFor="classroom-subject" className="text-xs vi-text-muted font-medium">Subject</label>
              <input id="classroom-subject" type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full px-3 py-2 rounded-xl border vi-border text-sm focus:border-violet-400 outline-none" />
            </div>
            <div className="space-y-1">
              <label htmlFor="classroom-capacity" className="text-xs vi-text-muted font-medium">Capacity</label>
              <input id="classroom-capacity" type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} className="w-full px-3 py-2 rounded-xl border vi-border text-sm focus:border-violet-400 outline-none" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border vi-border rounded-xl text-sm vi-text-muted hover:vi-bg">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
              {saving ? "Creating..." : "Create Classroom"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
