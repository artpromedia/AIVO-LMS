"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Bell } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";

interface DashboardHeaderProps {
  userName: string;
  userRole: string;
  userEmail?: string;
  avatarUrl?: string | null;
  accent?: "purple" | "violet" | "blue" | "pink" | "green";
  basePath: string;
  baseLabel: string;
}

const NOTIFICATIONS = [
  { id: "1", message: "New learner enrolled", time: "2m ago", read: false },
  { id: "2", message: "Assessment completed", time: "15m ago", read: false },
  { id: "3", message: "System health check passed", time: "1h ago", read: true },
];

function getBreadcrumbs(pathname: string, basePath: string, baseLabel: string) {
  const segments = pathname.replace(basePath, "").split("/").filter(Boolean);
  const crumbs = [{ label: baseLabel, href: basePath }];
  let path = basePath;
  for (const seg of segments) {
    path += `/${seg}`;
    crumbs.push({
      label: seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      href: path,
    });
  }
  return crumbs;
}

const ACCENT_TOKEN: Record<string, string> = {
  purple: "text-[hsl(var(--visual-primary))]",
  violet: "text-[hsl(var(--visual-primary))]",
  blue:   "text-[hsl(var(--visual-reading))]",
  pink:   "text-[hsl(var(--visual-math))]",
  green:  "text-[hsl(var(--visual-science))]",
};

export default function DashboardHeader({ userName, userRole, avatarUrl, accent = "purple", basePath, baseLabel }: DashboardHeaderProps) {
  const pathname = usePathname();
  const [showNotifications, setShowNotifications] = useState(false);
  const crumbs = getBreadcrumbs(pathname, basePath, baseLabel);
  const unreadCount = NOTIFICATIONS.filter((n) => !n.read).length;
  const accentColor = ACCENT_TOKEN[accent] || ACCENT_TOKEN.purple;

  return (
    <div className="bg-[hsl(var(--visual-surface))] border-b vi-border px-6 py-3 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-6">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
          {crumbs.map((crumb, i) => (
            <span key={crumb.href} className="flex items-center gap-1.5">
              {i > 0 && <span className="vi-text-muted opacity-60" aria-hidden="true">/</span>}
              {i === crumbs.length - 1 ? (
                <span className="font-semibold vi-text" aria-current="page">{crumb.label}</span>
              ) : (
                <Link href={crumb.href} className={`${accentColor} hover:underline font-medium`}>
                  {crumb.label}
                </Link>
              )}
            </span>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-2xl hover:vi-surface-soft transition vi-text-muted hover:vi-text"
            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
            aria-expanded={showNotifications}
            style={{ minHeight: 44, minWidth: 44 }}
          >
            <Bell size={20} strokeWidth={2.5} aria-hidden="true" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-[hsl(var(--visual-math))] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <>
              <div className="fixed inset-0 z-40" role="presentation" onClick={() => setShowNotifications(false)} />
              <div className="absolute right-0 top-full mt-2 w-80 vi-card overflow-hidden z-50 p-0">
                <div className="p-3 border-b vi-border flex items-center justify-between">
                  <span className="text-sm font-semibold vi-text">Notifications</span>
                  <span className="text-xs vi-text-muted">{unreadCount} unread</span>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {NOTIFICATIONS.map((n) => (
                    <div
                      key={n.id}
                      className={`px-3 py-2.5 border-b vi-border hover:vi-surface-soft transition ${!n.read ? "bg-[hsl(var(--visual-reading)/0.06)]" : ""}`}
                    >
                      <div className="flex items-start gap-2">
                        {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--visual-reading))] mt-1.5 flex-shrink-0" />}
                        <div>
                          <p className="text-sm vi-text">{n.message}</p>
                          <p className="text-xs vi-text-muted mt-0.5">{n.time}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-2 border-t vi-border">
                  <button className={`w-full text-center text-xs font-semibold ${accentColor} py-1.5 hover:underline`}>
                    View all notifications
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="h-6 w-px vi-border border-l" />

        <div className="flex items-center gap-2.5">
          <UserAvatar avatarUrl={avatarUrl} name={userName} size={32} />
          <div className="hidden md:block">
            <p className="text-sm font-medium vi-text leading-tight">{userName}</p>
            <p className="text-xs vi-text-muted font-medium uppercase tracking-wide">{userRole.replace(/_/g, " ")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
