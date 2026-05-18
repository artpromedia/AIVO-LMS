"use client";
import { useAuth } from "@/providers/auth-provider";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import DashboardHeader from "@/components/DashboardHeader";
import { SkipLink } from "@/components/a11y/SkipLink";
import {
  Briefcase,
  Megaphone,
  MessageCircle,
  Wrench,
  BarChart3,
  Settings,
  Home,
  ChevronLeft,
  ChevronRight,
  LogOut,
  type LucideIcon,
} from "lucide-react";

const INTERNAL_ROLES = [
  "PLATFORM_ADMIN",
  "SALES",
  "MARKETING",
  "CUSTOMER_CARE",
  "SUPPORT",
  "FINANCE",
  "DEVOPS",
];

const NAV_ITEMS: { href: string; label: string; Icon: LucideIcon; roles: string[] }[] = [
  {
    href: "/dashboard/internal/sales",
    label: "Sales",
    Icon: Briefcase,
    roles: ["SALES", "PLATFORM_ADMIN"],
  },
  {
    href: "/dashboard/internal/marketing",
    label: "Marketing",
    Icon: Megaphone,
    roles: ["MARKETING", "PLATFORM_ADMIN"],
  },
  {
    href: "/dashboard/internal/customer-care",
    label: "Customer Care",
    Icon: MessageCircle,
    roles: ["CUSTOMER_CARE", "PLATFORM_ADMIN"],
  },
  {
    href: "/dashboard/internal/support",
    label: "Support",
    Icon: Wrench,
    roles: ["SUPPORT", "PLATFORM_ADMIN"],
  },
  {
    href: "/dashboard/internal/finance",
    label: "Finance",
    Icon: BarChart3,
    roles: ["FINANCE", "PLATFORM_ADMIN"],
  },
  {
    href: "/dashboard/internal/devops",
    label: "DevOps",
    Icon: Settings,
    roles: ["DEVOPS", "PLATFORM_ADMIN"],
  },
];

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const ROUTE_ROLE_MAP: Record<string, string> = {
    "/dashboard/internal/sales": "SALES",
    "/dashboard/internal/marketing": "MARKETING",
    "/dashboard/internal/customer-care": "CUSTOMER_CARE",
    "/dashboard/internal/support": "SUPPORT",
    "/dashboard/internal/finance": "FINANCE",
    "/dashboard/internal/devops": "DEVOPS",
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push("/admin/login");
      return;
    }
    if (!loading && user) {
      if (!INTERNAL_ROLES.includes(user.role)) {
        router.push("/");
        return;
      }
      if (user.role !== "PLATFORM_ADMIN") {
        const matchedRoute = Object.entries(ROUTE_ROLE_MAP).find(([path]) =>
          pathname.startsWith(path),
        );
        if (matchedRoute && matchedRoute[1] !== user.role) {
          const allowedSlug = user.role.toLowerCase().replace(/_/g, "-");
          router.push(`/dashboard/internal/${allowedSlug}`);
        }
      }
    }
  }, [user, loading, router, pathname]);

  if (loading || !user) return null;

  const visibleNav = NAV_ITEMS.filter(
    (item) => user.role === "PLATFORM_ADMIN" || item.roles.includes(user.role),
  );

  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <div className="min-h-screen vi-bg flex">
      <SkipLink />
      <aside
        className={`${collapsed ? "w-16" : "w-60"} bg-[hsl(var(--visual-surface))] border-r vi-border flex flex-col transition-all duration-200 flex-shrink-0`}
        role="navigation"
        aria-label="Internal sidebar"
      >
        <div className="p-4 border-b vi-border flex items-center justify-between">
          {!collapsed && (
            <Link
              href={
                user.role === "PLATFORM_ADMIN"
                  ? "/dashboard/admin"
                  : `/dashboard/internal/${user.role.toLowerCase().replace(/_/g, "-")}`
              }
              className="flex items-center gap-3"
            >
              <div className="w-9 h-9 bg-[hsl(var(--visual-primary))] rounded-2xl flex items-center justify-center">
                <Image
                  src="/images/aivo-logo-white.png"
                  alt="AIVO"
                  width={22}
                  height={22}
                  style={{ height: "auto" }}
                />
              </div>
              <div>
                <p className="font-bold vi-text text-sm">AIVO</p>
                <p className="text-xs text-[hsl(var(--visual-primary))] font-semibold uppercase tracking-wider">
                  {user.role.replace(/_/g, " ")}
                </p>
              </div>
            </Link>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="vi-text-muted hover:vi-text p-1 transition"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight size={16} strokeWidth={2.5} />
            ) : (
              <ChevronLeft size={16} strokeWidth={2.5} />
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          {user.role === "PLATFORM_ADMIN" && (
            <div className="mb-3">
              {!collapsed && (
                <p className="px-4 text-xs font-bold vi-text-muted uppercase tracking-wider mb-1">
                  Admin
                </p>
              )}
              <Link
                href="/dashboard/admin"
                aria-label="Platform Admin"
                className="flex items-center gap-3 px-4 py-2.5 text-sm transition mx-2 rounded-2xl vi-text-muted hover:vi-surface-soft hover:vi-text"
                style={{ minHeight: 44 }}
              >
                <Home size={18} strokeWidth={2.5} className="flex-shrink-0" aria-hidden="true" />
                {!collapsed && <span>Platform Admin</span>}
              </Link>
            </div>
          )}

          {!collapsed && (
            <p className="px-4 text-xs font-bold vi-text-muted uppercase tracking-wider mb-1">
              Teams
            </p>
          )}
          {visibleNav.map((item) => {
            const Icon = item.Icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm transition mx-2 rounded-2xl ${
                  active
                    ? "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] font-semibold shadow-sm"
                    : "vi-text-muted hover:vi-surface-soft hover:vi-text"
                }`}
                style={{ minHeight: 44 }}
              >
                <Icon size={18} strokeWidth={2.5} className="flex-shrink-0" aria-hidden="true" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t vi-border">
          {!collapsed && (
            <div className="mb-3">
              <p className="text-sm font-semibold vi-text truncate">{user.name}</p>
              <p className="text-xs vi-text-muted">{user.role.replace(/_/g, " ")}</p>
            </div>
          )}
          <button
            onClick={logout}
            aria-label="Sign out"
            className={`inline-flex items-center gap-2 text-xs vi-text-muted hover:text-[hsl(var(--visual-math))] transition ${collapsed ? "w-full justify-center" : ""}`}
          >
            <LogOut size={14} strokeWidth={2.5} />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      <main id="main-content" tabIndex={-1} className="flex-1 overflow-auto flex flex-col">
        <DashboardHeader
          userName={user.name || "Team Member"}
          userRole={user.role}
          userEmail={user.email || undefined}
          accent="purple"
          basePath="/dashboard/internal"
          baseLabel="Internal"
        />
        <div className="flex-1 overflow-auto">{children}</div>
      </main>
    </div>
  );
}
