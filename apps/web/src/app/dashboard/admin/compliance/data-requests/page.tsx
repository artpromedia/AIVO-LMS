"use client";
import { useAuth } from "@/providers/auth-provider";
import { useState } from "react";
import Link from "next/link";
import { IconWell, StatIconWell } from "@/components/discovery/_vi";
import { ClipboardList, Clock, Loader2, CheckCircle2, Plus, type LucideIcon } from "lucide-react";

interface DataRequest {
  id: string;
  type: string;
  status: string;
  subjectEmail: string;
  notes: string;
  slaDeadline: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  submitted: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]",
  in_progress: "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]",
  completed: "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]",
  rejected: "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]",
};

const SAMPLE_REQUESTS: DataRequest[] = [
  {
    id: "1",
    type: "DSAR_EXPORT",
    status: "submitted",
    subjectEmail: "parent@example.com",
    notes: "Requesting all data for my child",
    slaDeadline: new Date(Date.now() + 30 * 86400000).toISOString(),
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: "2",
    type: "DSAR_DELETE",
    status: "in_progress",
    subjectEmail: "user@school.edu",
    notes: "GDPR right to be forgotten",
    slaDeadline: new Date(Date.now() + 15 * 86400000).toISOString(),
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: "3",
    type: "FERPA_REQUEST",
    status: "completed",
    subjectEmail: "admin@district.org",
    notes: "Student records for transfer",
    slaDeadline: new Date(Date.now() - 5 * 86400000).toISOString(),
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
];

export default function DataRequestsPage() {
  const { accessToken } = useAuth();
  const [requests, setRequests] = useState<DataRequest[]>(SAMPLE_REQUESTS);
  const [showCreate, setShowCreate] = useState(false);
  const [newType, setNewType] = useState("DSAR_EXPORT");
  const [newEmail, setNewEmail] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const handleCreate = () => {
    if (!newEmail) return;
    const req: DataRequest = {
      id: crypto.randomUUID(),
      type: newType,
      status: "submitted",
      subjectEmail: newEmail,
      notes: newNotes,
      slaDeadline: new Date(Date.now() + 30 * 86400000).toISOString(),
      createdAt: new Date().toISOString(),
    };
    setRequests([req, ...requests]);
    setNewEmail("");
    setNewNotes("");
    setShowCreate(false);
  };

  const daysUntilDeadline = (deadline: string) => {
    const diff = new Date(deadline).getTime() - Date.now();
    return Math.ceil(diff / 86400000);
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3 text-sm vi-text-muted">
        <Link
          href="/dashboard/admin/compliance"
          className="hover:text-[hsl(var(--visual-primary))] transition"
        >
          Compliance
        </Link>
        <span>/</span>
        <span className="vi-text font-medium">Data Requests</span>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <IconWell color="primary">
            <ClipboardList size={28} strokeWidth={2.5} aria-hidden="true" />
          </IconWell>
          <div>
            <h1 className="text-2xl font-heading font-bold vi-text">Data Requests</h1>
            <p className="text-sm vi-text-muted mt-1">
              Manage DSAR, GDPR, and FERPA data subject requests with SLA tracking.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-5 py-2.5 rounded-xl bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 transition flex items-center gap-2"
        >
          <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
          New Request
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {(
          [
            {
              label: "Total Requests",
              value: requests.length,
              Icon: ClipboardList,
              well: "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]",
            },
            {
              label: "Pending",
              value: requests.filter((r) => r.status === "submitted").length,
              Icon: Clock,
              well: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]",
            },
            {
              label: "In Progress",
              value: requests.filter((r) => r.status === "in_progress").length,
              Icon: Loader2,
              well: "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]",
            },
            {
              label: "Completed",
              value: requests.filter((r) => r.status === "completed").length,
              Icon: CheckCircle2,
              well: "bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))]",
            },
          ] as { label: string; value: number; Icon: LucideIcon; well: string }[]
        ).map((m) => {
          const Icon = m.Icon;
          return (
            <div
              key={m.label}
              className="bg-white rounded-xl p-4 shadow-sm border vi-border flex items-center gap-3"
            >
              <StatIconWell wellClass={m.well}>
                <Icon size={22} strokeWidth={2.5} aria-hidden="true" />
              </StatIconWell>
              <div>
                <p className="text-xl font-bold vi-text leading-tight">{m.value}</p>
                <p className="text-xs vi-text-muted font-semibold">{m.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="vi-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left vi-text-muted border-b vi-border vi-bg/50">
              <th className="px-5 py-3 font-semibold">Type</th>
              <th className="px-5 py-3 font-semibold">Subject</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">SLA Deadline</th>
              <th className="px-5 py-3 font-semibold">Created</th>
              <th className="px-5 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((req) => {
              const daysLeft = daysUntilDeadline(req.slaDeadline);
              return (
                <tr key={req.id} className="border-b vi-border hover:vi-bg/50 transition">
                  <td className="px-5 py-3">
                    <span className="font-mono text-xs vi-surface-soft px-2 py-1 rounded">
                      {req.type}
                    </span>
                  </td>
                  <td className="px-5 py-3 vi-text">{req.subjectEmail}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`px-2.5 py-0.5 text-xs rounded-full font-semibold ${STATUS_COLORS[req.status] || "vi-surface-soft vi-text-muted"}`}
                    >
                      {req.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`text-sm ${daysLeft < 5 ? "text-red-600 font-semibold" : daysLeft < 15 ? "text-amber-600" : "vi-text-muted"}`}
                    >
                      {daysLeft > 0
                        ? `${daysLeft} days left`
                        : `${Math.abs(daysLeft)} days overdue`}
                    </span>
                  </td>
                  <td className="px-5 py-3 vi-text-muted">
                    {new Date(req.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3">
                    {req.status !== "completed" && (
                      <button
                        onClick={() =>
                          setRequests(
                            requests.map((r) =>
                              r.id === req.id
                                ? {
                                    ...r,
                                    status:
                                      req.status === "submitted" ? "in_progress" : "completed",
                                  }
                                : r,
                            ),
                          )
                        }
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg vi-surface-soft text-[hsl(var(--visual-primary))] hover:bg-[hsl(var(--visual-primary)/0.12)] border border-[hsl(var(--visual-primary)/0.3)] transition"
                      >
                        {req.status === "submitted" ? "Start Processing" : "Mark Complete"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            role="presentation"
            onClick={() => setShowCreate(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4">
            <div className="p-6 border-b vi-border">
              <h2 className="text-lg font-heading font-bold vi-text">New Data Request</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="dr-type" className="block text-sm font-medium vi-text mb-1">
                  Request Type
                </label>
                <select
                  id="dr-type"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border vi-border text-sm bg-white focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none"
                >
                  <option value="DSAR_EXPORT">DSAR - Data Export</option>
                  <option value="DSAR_DELETE">DSAR - Data Deletion</option>
                  <option value="FERPA_REQUEST">FERPA Request</option>
                  <option value="COPPA_VERIFICATION">COPPA Verification</option>
                </select>
              </div>
              <div>
                <label htmlFor="dr-email" className="block text-sm font-medium vi-text mb-1">
                  Subject Email
                </label>
                <input
                  id="dr-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border vi-border text-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none"
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label htmlFor="dr-notes" className="block text-sm font-medium vi-text mb-1">
                  Notes
                </label>
                <textarea
                  id="dr-notes"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border vi-border text-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCreate(false)}
                  className="flex-1 py-2.5 rounded-xl border vi-border vi-text-muted font-semibold hover:vi-bg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newEmail}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-700 transition disabled:opacity-50"
                >
                  Submit Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
