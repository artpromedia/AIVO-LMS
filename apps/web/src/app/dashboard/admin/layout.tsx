"use client";
import { useAuth } from "@/providers/auth-provider";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import DashboardHeader from "@/components/DashboardHeader";
import CommandPalette from "@/components/CommandPalette";
import { SkipLink } from "@/components/a11y/SkipLink";
import {
  BarChart3,
  Bell,
  Activity,
  TrendingUp,
  Users,
  GraduationCap,
  Building2,
  Brain,
  Gamepad2,
  Search,
  CreditCard,
  Wallet,
  Receipt,
  Tag,
  Shield,
  ScrollText,
  ClipboardList,
  Settings,
  Mail,
  Webhook,
  KeyRound,
  Cpu,
  HeartPulse,
  ChevronLeft,
  ChevronRight,
  LogOut,
  type LucideIcon,
} from "lucide-react";

const NAV_SECTIONS: {
  label: string;
  items: { href: string; label: string; Icon: LucideIcon }[];
}[] = [
  {
    label: "Platform",
    items: [
      { href: "/dashboard/admin", label: "Overview", Icon: BarChart3 },
      { href: "/dashboard/admin/activity", label: "Activity Feed", Icon: Bell },
      { href: "/dashboard/admin/services", label: "Services & Health", Icon: Activity },
      { href: "/dashboard/admin/jobs", label: "Background Jobs", Icon: Cpu },
      { href: "/dashboard/admin/jobs/freshness", label: "Job Freshness", Icon: HeartPulse },
      { href: "/dashboard/admin/analytics", label: "Analytics & Research", Icon: TrendingUp },
    ],
  },
  {
    label: "Management",
    items: [
      { href: "/dashboard/admin/users", label: "Users & Roles", Icon: Users },
      { href: "/dashboard/admin/learners", label: "Learners", Icon: GraduationCap },
      { href: "/dashboard/admin/tenants", label: "Tenants & Districts", Icon: Building2 },
    ],
  },
  {
    label: "AI & Learning",
    items: [
      { href: "/dashboard/admin/ai", label: "AI & Brain Models", Icon: Brain },
      { href: "/dashboard/admin/ai/playground", label: "Prompt Playground", Icon: Gamepad2 },
      { href: "/dashboard/admin/ai/moderation", label: "Content Moderation", Icon: Search },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/dashboard/admin/billing", label: "Billing & Licensing", Icon: CreditCard },
      { href: "/dashboard/admin/billing/coupons", label: "Coupons", Icon: Tag },
      { href: "/dashboard/admin/billing/revenue", label: "Revenue", Icon: Wallet },
      { href: "/dashboard/admin/billing/invoices", label: "Invoices", Icon: Receipt },
      { href: "/dashboard/admin/compliance", label: "Compliance & Audit", Icon: Shield },
      { href: "/dashboard/admin/compliance/audit-log", label: "Audit Log", Icon: ScrollText },
      {
        href: "/dashboard/admin/compliance/data-requests",
        label: "Data Requests",
        Icon: ClipboardList,
      },
      { href: "/dashboard/admin/settings", label: "Platform Settings", Icon: Settings },
      { href: "/dashboard/admin/settings/emails", label: "Email Templates", Icon: Mail },
      { href: "/dashboard/admin/settings/webhooks", label: "Webhooks", Icon: Webhook },
      { href: "/dashboard/admin/settings/api-keys", label: "API Keys", Icon: KeyRound },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/admin/login");
    } else if (!loading && user) {
      if (user.role === "DISTRICT_ADMIN") {
        router.push("/dashboard/district");
      } else if (user.role !== "PLATFORM_ADMIN") {
        router.push("/");
      }
    }
  }, [user, loading, router]);

  if (loading || !user) return null;

  const isActive = (href: string) => {
    if (href === "/dashboard/admin") return pathname === "/dashboard/admin";
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen vi-bg flex">
      <SkipLink />
      <aside
        className={`${collapsed ? "w-16" : "w-64"} bg-[hsl(var(--visual-surface))] border-r vi-border flex flex-col transition-all duration-200 flex-shrink-0`}
        role="navigation"
        aria-label="Admin sidebar"
      >
        <div className="p-4 border-b vi-border flex items-center justify-between">
          {!collapsed && (
            <Link href="/dashboard/admin" className="flex items-center gap-3">
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
                  Admin
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
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="mb-3">
              {!collapsed && (
                <p className="px-4 text-xs font-bold vi-text-muted uppercase tracking-wider mb-1">
                  {section.label}
                </p>
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
                    <Icon
                      size={18}
                      strokeWidth={2.5}
                      className="flex-shrink-0"
                      aria-hidden="true"
                    />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
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
          userName={user.name || "Admin"}
          userRole={user.role}
          userEmail={user.email || undefined}
          accent="purple"
          basePath="/dashboard/admin"
          baseLabel="Admin"
        />
        <div className="flex-1 overflow-auto">{children}</div>
      </main>
      <CommandPalette />
    </div>
  );
}
