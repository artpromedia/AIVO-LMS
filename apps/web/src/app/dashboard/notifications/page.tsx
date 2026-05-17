"use client";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { IconWell } from "@/components/discovery/_vi";
import { Bell, Trophy, AlertTriangle, Info, Target, type LucideIcon } from "lucide-react";

interface Notification {
  id: string;
  type: "achievement" | "alert" | "info" | "milestone" | "system";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  link?: string;
}

const TYPE_ICONS: Record<string, LucideIcon> = {
  achievement: Trophy,
  alert: AlertTriangle,
  info: Info,
  milestone: Target,
  system: Bell,
};

const TYPE_TONE: Record<string, string> = {
  achievement: "sel",
  alert: "math",
  info: "reading",
  milestone: "science",
  system: "primary",
};

const TYPE_COLORS: Record<string, string> = {
  achievement: "bg-[hsl(var(--visual-sel)/0.08)] border-[hsl(var(--visual-sel)/0.3)]",
  alert: "bg-[hsl(var(--visual-math)/0.08)] border-[hsl(var(--visual-math)/0.3)]",
  info: "bg-[hsl(var(--visual-reading)/0.08)] border-[hsl(var(--visual-reading)/0.3)]",
  milestone: "bg-[hsl(var(--visual-science)/0.08)] border-[hsl(var(--visual-science)/0.3)]",
  system: "vi-surface-soft vi-border",
};

export default function NotificationsPage() {
  const { user, accessToken, loading } = useAuth();
  const t = useTranslations("common");
  const td = useTranslations("dashboard");
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => { if (!loading && !user) router.push("/login"); }, [user, loading, router]);

  useEffect(() => {
    if (!accessToken || !user) return;
    fetch("/api/comms/notifications", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(r => r.ok ? r.json() : { notifications: [] })
      .then(data => {
        const notifs = Array.isArray(data?.notifications) ? data.notifications : [];
        if (notifs.length === 0) {
          setNotifications([
            { id: "demo1", type: "achievement", title: "Welcome to AIVO!", message: "Your account has been created. Start exploring your personalized learning journey.", read: false, createdAt: new Date().toISOString() },
            { id: "demo2", type: "info", title: "Complete Your Profile", message: "Add a learner to get started with AI-powered tutoring sessions.", read: false, createdAt: new Date(Date.now() - 3600000).toISOString() },
            { id: "demo3", type: "system", title: "Platform Update", message: "New tutors and quest worlds are now available. Check the tutor store for details.", read: true, createdAt: new Date(Date.now() - 86400000).toISOString() },
          ]);
        } else {
          setNotifications(notifs);
        }
      })
      .catch(() => {
        setNotifications([
          { id: "demo1", type: "info", title: "Welcome to AIVO!", message: "Your notification center is ready. Updates about your learning journey will appear here.", read: false, createdAt: new Date().toISOString() },
        ]);
      })
      .finally(() => setLoadingNotifs(false));
  }, [accessToken, user]);

  if (loading || !user) return null;

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const filtered = filter === "unread" ? notifications.filter(n => !n.read) : notifications;
  const unreadCount = notifications.filter(n => !n.read).length;

  const dashboardLink = user.role === "PARENT" ? "/dashboard/parent" :
    user.role === "LEARNER" ? "/dashboard/learner" :
    user.role === "TEACHER" ? "/dashboard/teacher" :
    user.role === "THERAPIST" ? "/dashboard/therapist" :
    user.role === "CAREGIVER" ? "/dashboard/caregiver" :
    "/dashboard/admin";

  return (
    <div className="min-h-screen vi-bg">
      <header className="bg-[hsl(var(--visual-surface))]/80 backdrop-blur border-b vi-border px-8 py-4 flex items-center justify-between">
        <Image src="/images/aivo-logo-purple.png" alt="AIVO" width={120} height={36} style={{ height: "auto" }} />
        <div className="flex items-center gap-4">
          <Link href={dashboardLink} className="text-sm text-[hsl(var(--visual-primary))] font-semibold hover:underline">Dashboard</Link>
          <span className="text-sm font-semibold vi-text-muted">{user.name}</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <header className="flex items-center gap-4 mb-6">
          <IconWell color="primary">
            <Bell size={28} strokeWidth={2.5} aria-hidden="true" />
          </IconWell>
          <div className="flex-1">
            <h1 className="text-2xl font-heading font-bold vi-text leading-tight">{td("overview")}</h1>
            {unreadCount > 0 && (
              <p className="text-sm vi-text-muted font-medium mt-1">{unreadCount} unread</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 vi-surface-soft rounded-xl p-1">
              {(["all", "unread"] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition capitalize ${filter === f ? "bg-[hsl(var(--visual-surface))] vi-text shadow-sm" : "vi-text-muted"}`}>
                  {f} {f === "unread" ? `(${unreadCount})` : ""}
                </button>
              ))}
            </div>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-[hsl(var(--visual-primary))] font-semibold hover:underline">Mark all read</button>
            )}
          </div>
        </header>

        {loadingNotifs ? (
          <div className="vi-card p-12 text-center animate-pulse vi-text-muted">Loading notifications...</div>
        ) : filtered.length === 0 ? (
          <div className="vi-card p-12 text-center">
            <div className="flex justify-center mb-3">
              <IconWell color="primary">
                <Bell size={28} strokeWidth={2.5} aria-hidden="true" />
              </IconWell>
            </div>
            <p className="vi-text-muted font-semibold">{filter === "unread" ? "No unread notifications" : "No notifications yet"}</p>
            <p className="text-xs vi-text-muted mt-1">Updates about your learning journey will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(n => {
              const Icon = TYPE_ICONS[n.type] || Bell;
              return (
              <div key={n.id}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") markAsRead(n.id); }}
                onClick={() => markAsRead(n.id)}
                className={`rounded-xl border-2 p-4 cursor-pointer transition hover:shadow-sm ${n.read ? "bg-[hsl(var(--visual-surface))] vi-border opacity-70" : TYPE_COLORS[n.type]}`}>
                <div className="flex items-start gap-3">
                  <IconWell color={TYPE_TONE[n.type] || "primary"} size="sm">
                    <Icon size={18} strokeWidth={2.5} aria-hidden="true" />
                  </IconWell>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className={`text-sm font-semibold ${n.read ? "vi-text-muted" : "vi-text"}`}>{n.title}</h3>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!n.read && <span className="w-2 h-2 rounded-full bg-[hsl(var(--visual-primary))]" />}
                        <span className="text-xs vi-text-muted">{formatTime(n.createdAt)}</span>
                      </div>
                    </div>
                    <p className={`text-sm mt-0.5 ${n.read ? "vi-text-muted" : "vi-text-muted"}`}>{n.message}</p>
                    {n.link && (
                      <Link href={n.link} className="text-xs text-[hsl(var(--visual-primary))] font-semibold hover:underline mt-1 inline-block">View details →</Link>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return new Date(iso).toLocaleDateString();
}
