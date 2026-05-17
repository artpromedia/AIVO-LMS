"use client";
import { useAuth } from "@/providers/auth-provider";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import DashboardHeader from "@/components/DashboardHeader";
import { SkipLink } from "@/components/a11y/SkipLink";
import {
  BarChart3,
  School,
  DoorOpen,
  GraduationCap,
  Users,
  Home,
  ClipboardList,
  Target,
  TrendingUp,
  Activity,
  Plug,
  Settings,
  ScrollText,
  ShieldCheck,
  Palette,
  ChevronLeft,
  ChevronRight,
  LogOut,
  type LucideIcon,
} from "lucide-react";

const NAV_SECTIONS: { label: string; items: { href: string; label: string; Icon: LucideIcon }[] }[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard/district", label: "Dashboard", Icon: BarChart3 },
      { href: "/dashboard/district/schools", label: "Schools", Icon: School },
      { href: "/dashboard/district/classrooms", label: "Classrooms", Icon: DoorOpen },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/dashboard/district/learners", label: "Learners", Icon: GraduationCap },
      { href: "/dashboard/district/staff", label: "Staff & Teachers", Icon: Users },
      { href: "/dashboard/district/families", label: "Parents & Families", Icon: Home },
    ],
  },
  {
    label: "Teaching & Learning",
    items: [
      { href: "/dashboard/district/iep", label: "IEP Management", Icon: ClipboardList },
      { href: "/dashboard/district/interventions", label: "Interventions", Icon: Target },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/dashboard/district/analytics", label: "Analytics & Reports", Icon: TrendingUp },
      { href: "/dashboard/district/usage", label: "Usage & Limits", Icon: Activity },
    ],
  },
  {
    label: "Connect",
    items: [
      { href: "/dashboard/district/integrations", label: "Integrations", Icon: Plug },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/dashboard/district/settings/admins", label: "Administrators", Icon: ShieldCheck },
      { href: "/dashboard/district/settings/branding", label: "Branding", Icon: Palette },
      { href: "/dashboard/district/settings", label: "District Settings", Icon: Settings },
      { href: "/dashboard/district/activity", label: "Activity Log", Icon: ScrollText },
    ],
  },
];

export default function DistrictLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/district/login");
    if (!loading && user && !["DISTRICT_ADMIN", "PLATFORM_ADMIN"].includes(user.role)) router.push("/");
  }, [user, loading, router]);

  if (loading || !user) return null;

  const isActive = (href: string) => {
    if (href === "/dashboard/district") return pathname === "/dashboard/district";
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen vi-bg flex">
      <SkipLink />
      <aside
        className={`${collapsed ? "w-16" : "w-64"} bg-[hsl(var(--visual-surface))] border-r vi-border flex flex-col transition-all duration-200 flex-shrink-0`}
        role="navigation"
        aria-label="District sidebar"
      >
        <div className="p-4 border-b vi-border flex items-center justify-between">
          {!collapsed && (
            <Link href="/dashboard/district" className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[hsl(var(--visual-primary))] rounded-2xl flex items-center justify-center">
                <Image src="/images/aivo-logo-white.png" alt="AIVO" width={22} height={22} style={{ height: "auto" }} />
              </div>
              <div>
                <p className="font-bold vi-text text-sm">AIVO</p>
                <p className="text-xs text-[hsl(var(--visual-primary))] font-semibold uppercase tracking-wider">District Admin</p>
              </div>
            </Link>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="vi-text-muted hover:vi-text p-1 transition"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={16} strokeWidth={2.5} /> : <ChevronLeft size={16} strokeWidth={2.5} />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="mb-3">
              {!collapsed && (
                <p className="px-4 text-xs font-bold vi-text-muted uppercase tracking-wider mb-1">{section.label}</p>
              )}
              {section.items.map((item) => {
                const Icon = item.Icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-label={item.label}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-all mx-2 rounded-2xl ${
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
            </div>
          ))}
        </nav>

        <div className="p-4 border-t vi-border">
          {!collapsed && (
            <>
              <div className="mb-3">
                <p className="text-sm font-semibold vi-text truncate">{user.name}</p>
                <p className="text-xs vi-text-muted">{user.role.replace(/_/g, " ")}</p>
              </div>
              <div className="vi-surface-soft rounded-2xl p-3 mb-3">
                <p className="text-xs font-medium text-[hsl(var(--visual-primary))]">Need help?</p>
                <p className="text-xs vi-text-muted mt-0.5">Contact your platform administrator for support.</p>
              </div>
            </>
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
          userName={user.name || "District Admin"}
          userRole={user.role}
          userEmail={user.email || undefined}
          accent="purple"
          basePath="/dashboard/district"
          baseLabel="District"
        />
        <div className="flex-1 overflow-auto">{children}</div>
      </main>
    </div>
  );
}
