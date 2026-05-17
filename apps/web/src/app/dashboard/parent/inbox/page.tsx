"use client";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Brain, Lightbulb, ClipboardList, Trophy, TrendingUp, Users, Info, Bell, Inbox as InboxIcon, type LucideIcon } from "lucide-react";

interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string;
  actionUrl?: string;
  urgency: string;
  readAt: string | null;
  createdAt: string;
  learnerId?: string;
}

const TYPE_META: Record<string, { Icon: LucideIcon; color: string }> = {
  brain_review: { Icon: Brain, color: "primary" },
  recommendation: { Icon: Lightbulb, color: "sel" },
  iep_reminder: { Icon: ClipboardList, color: "reading" },
  milestone: { Icon: Trophy, color: "sel" },
  progress: { Icon: TrendingUp, color: "science" },
  team: { Icon: Users, color: "reading" },
  system: { Icon: Info, color: "primary" },
};

const WELL_CLASS: Record<string, string> = {
  primary: "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]",
  math: "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]",
  reading: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]",
  science: "bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))]",
  sel: "bg-[hsl(var(--visual-sel)/0.12)] text-[hsl(var(--visual-sel))]",
};

const TABS = [
  { key: "all", label: "All" },
  { key: "action", label: "Action Needed" },
  { key: "celebrations", label: "Celebrations" },
  { key: "archived", label: "Archive" },
];

export default function InboxPage() {
  const { user, accessToken, loading } = useAuth();
  const t = useTranslations("parent");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!accessToken || !user) return;
    setLoadingData(true);
    fetch(`/api/family/inbox/${user.id}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.ok ? r.json() : { items: [] })
      .then(data => setNotifications(data.items || []))
      .catch(() => {})
      .finally(() => setLoadingData(false));
  }, [accessToken, user]);

  if (loading || !user) return null;

  const markAsRead = async (id: string) => {
    await fetch(`/api/family/inbox/${id}/read`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
  };

  const dismiss = async (id: string) => {
    await fetch(`/api/family/inbox/${id}/dismiss`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const filtered = notifications.filter(n => {
    if (activeTab === "action") return ["brain_review", "recommendation", "iep_reminder"].includes(n.type) && !n.readAt;
    if (activeTab === "celebrations") return ["milestone", "progress"].includes(n.type);
    if (activeTab === "archived") return !!n.readAt;
    return true;
  });

  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-6 py-6">
      <h1 className="text-2xl font-heading font-bold vi-text mb-6">Inbox</h1>

      <div className="flex gap-1 mb-6 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition ${
              activeTab === tab.key ? "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]" : "vi-surface-soft vi-text-muted hover:bg-[hsl(var(--visual-border))]"
            }`} style={{ minHeight: 44 }}>
            {tab.label}
          </button>
        ))}
      </div>

      {loadingData ? (
        <div className="text-center py-16 vi-text-muted animate-pulse">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] flex items-center justify-center mx-auto mb-3">
            <InboxIcon size={24} aria-hidden="true" />
          </div>
          <p className="vi-text-muted font-semibold">
            {activeTab === "all" ? "Your inbox is empty. We'll let you know when something needs attention." : `No ${activeTab} items.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(n => {
            const meta = TYPE_META[n.type] || { Icon: Bell, color: "primary" };
            const Icon = meta.Icon;
            return (
              <div key={n.id}
                className={`vi-card p-4 transition hover:shadow-md ${
                  !n.readAt ? "border-[hsl(var(--visual-primary)/0.3)] border-l-4 border-l-[hsl(var(--visual-primary))]" : ""
                }`}>
                <div className="flex items-start gap-3">
                  <span className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${WELL_CLASS[meta.color] || WELL_CLASS.primary}`}>
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 justify-between">
                      <p className={`text-sm ${!n.readAt ? "font-bold vi-text" : "font-semibold text-slate-800"}`}>{n.title}</p>
                      <span className="text-xs vi-text-muted flex-shrink-0">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {n.body && <p className="text-sm vi-text-muted mt-1">{n.body}</p>}
                    <div className="flex items-center gap-2 mt-3">
                      {n.actionUrl && (
                        <a href={n.actionUrl} className="px-3 py-1.5 text-xs rounded-full bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] font-semibold hover:bg-[hsl(var(--visual-primary)/0.2)] transition" style={{ minHeight: 32 }}>
                          View →
                        </a>
                      )}
                      {!n.readAt && (
                        <button onClick={() => markAsRead(n.id)} className="px-3 py-1.5 text-xs rounded-full vi-surface-soft vi-text-muted font-semibold hover:bg-[hsl(var(--visual-border))] transition" style={{ minHeight: 32 }}>
                          Mark Read
                        </button>
                      )}
                      <button onClick={() => dismiss(n.id)} className="px-3 py-1.5 text-xs rounded-full vi-text-muted hover:text-[hsl(var(--visual-math))] hover:bg-[hsl(var(--visual-math)/0.06)] transition" style={{ minHeight: 32 }}>
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
