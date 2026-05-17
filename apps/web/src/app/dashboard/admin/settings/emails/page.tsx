"use client";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState } from "react";
import Link from "next/link";
import { IconWell } from "@/components/discovery/_vi";
import { Mail } from "lucide-react";

interface EmailTemplate {
  id: string;
  key: string;
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  variables: string[];
  active: boolean;
  updatedAt: string;
}

const DEFAULT_TEMPLATES: EmailTemplate[] = [
  { id: "1", key: "welcome", subject: "Welcome to AIVO!", bodyHtml: "<h1>Welcome {{name}}!</h1><p>Your learning journey begins now.</p>", bodyText: null, variables: ["name", "email"], active: true, updatedAt: new Date().toISOString() },
  { id: "2", key: "password_reset", subject: "Reset Your Password", bodyHtml: "<p>Hi {{name}}, click <a href='{{resetUrl}}'>here</a> to reset your password.</p>", bodyText: null, variables: ["name", "resetUrl"], active: true, updatedAt: new Date().toISOString() },
  { id: "3", key: "learner_progress", subject: "{{learnerName}}'s Weekly Progress", bodyHtml: "<p>Hi {{parentName}}, here's {{learnerName}}'s progress this week...</p>", bodyText: null, variables: ["parentName", "learnerName", "progressSummary"], active: true, updatedAt: new Date().toISOString() },
  { id: "4", key: "subscription_renewal", subject: "Your Subscription Renews Soon", bodyHtml: "<p>Hi {{name}}, your {{planName}} subscription renews on {{renewalDate}}.</p>", bodyText: null, variables: ["name", "planName", "renewalDate"], active: false, updatedAt: new Date().toISOString() },
];

export default function EmailTemplatesPage() {
  const { accessToken } = useAuth();
  const [templates, setTemplates] = useState<EmailTemplate[]>(DEFAULT_TEMPLATES);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [preview, setPreview] = useState<EmailTemplate | null>(null);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3 text-sm vi-text-muted">
        <Link href="/dashboard/admin/settings" className="hover:text-[hsl(var(--visual-primary))] transition">Settings</Link>
        <span>/</span>
        <span className="vi-text font-medium">Email Templates</span>
      </div>

      <div className="flex items-center gap-4">
        <IconWell color="primary">
          <Mail size={28} strokeWidth={2.5} aria-hidden="true" />
        </IconWell>
        <div>
          <h1 className="text-2xl font-heading font-bold vi-text">Email Templates</h1>
          <p className="text-sm vi-text-muted mt-1">Manage transactional and notification email templates.</p>
        </div>
      </div>

      <div className="vi-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left vi-text-muted border-b vi-border vi-bg/50">
              <th className="px-5 py-3 font-semibold">Template</th>
              <th className="px-5 py-3 font-semibold">Subject</th>
              <th className="px-5 py-3 font-semibold">Variables</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((tmpl) => (
              <tr key={tmpl.id} className="border-b vi-border hover:vi-bg/50 transition">
                <td className="px-5 py-3">
                  <span className="font-mono text-xs vi-surface-soft px-2 py-1 rounded">{tmpl.key}</span>
                </td>
                <td className="px-5 py-3 font-medium vi-text">{tmpl.subject}</td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap gap-1">
                    {tmpl.variables.map((v) => (
                      <span key={v} className="text-xs vi-surface-soft text-[hsl(var(--visual-primary))] px-2 py-0.5 rounded-full">{`{{${v}}}`}</span>
                    ))}
                  </div>
                </td>
                <td className="px-5 py-3">
                  <span className={`px-2.5 py-0.5 text-xs rounded-full font-semibold ${tmpl.active ? "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]" : "vi-surface-soft vi-text-muted"}`}>
                    {tmpl.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPreview(tmpl)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg vi-bg vi-text-muted hover:vi-surface-soft border vi-border transition"
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => setEditing(tmpl)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg vi-surface-soft text-[hsl(var(--visual-primary))] hover:bg-[hsl(var(--visual-primary)/0.12)] border border-[hsl(var(--visual-primary)/0.3)] transition"
                    >
                      Edit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {preview && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" role="presentation" onClick={() => setPreview(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-auto">
            <div className="p-6 border-b vi-border flex items-center justify-between">
              <h2 className="text-lg font-heading font-bold vi-text">Preview: {preview.key}</h2>
              <button onClick={() => setPreview(null)} className="vi-text-muted hover:vi-text-muted text-xl">&times;</button>
            </div>
            <div className="p-6">
              <p className="text-sm vi-text-muted mb-2">Subject: <strong>{preview.subject}</strong></p>
              <div className="border vi-border rounded-xl p-4 vi-bg">
                <div dangerouslySetInnerHTML={{ __html: preview.bodyHtml }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" role="presentation" onClick={() => setEditing(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-auto">
            <div className="p-6 border-b vi-border">
              <h2 className="text-lg font-heading font-bold vi-text">Edit Template: {editing.key}</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="edit-subject" className="block text-sm font-medium vi-text mb-1">Subject</label>
                <input
                  id="edit-subject"
                  type="text"
                  value={editing.subject}
                  onChange={(e) => setEditing({ ...editing, subject: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border vi-border text-sm focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none"
                />
              </div>
              <div>
                <label htmlFor="edit-body" className="block text-sm font-medium vi-text mb-1">HTML Body</label>
                <textarea
                  id="edit-body"
                  value={editing.bodyHtml}
                  onChange={(e) => setEditing({ ...editing, bodyHtml: e.target.value })}
                  rows={10}
                  className="w-full px-4 py-2.5 rounded-xl border vi-border text-sm font-mono focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditing(null)} className="flex-1 py-2.5 rounded-xl border vi-border vi-text-muted font-semibold hover:vi-bg transition">Cancel</button>
                <button
                  onClick={() => {
                    setTemplates(templates.map((t) => t.id === editing.id ? editing : t));
                    setEditing(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-700 transition"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
