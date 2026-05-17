"use client";
import { useAuth } from "@/providers/auth-provider";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import DashboardHeader from "@/components/DashboardHeader";
import { SkipLink } from "@/components/a11y/SkipLink";
import { ChevronLeft, ChevronRight, X, Menu, LogOut, type LucideIcon } from "lucide-react";

type Tone = "reading" | "math" | "science" | "primary";

const ACCENT_TONE: Record<"blue" | "pink" | "green" | "purple", Tone> = {
  blue: "reading",
  pink: "math",
  green: "science",
  purple: "primary",
};

const TONE_CLASSES: Record<Tone, {
  solidBg: string;
  roleText: string;
  activeBg: string;
  activeText: string;
  focusRing: string;
}> = {
  reading: {
    solidBg: "bg-[hsl(var(--visual-reading))]",
    roleText: "text-[hsl(var(--visual-reading))]",
    activeBg: "bg-[hsl(var(--visual-reading)/0.12)]",
    activeText: "text-[hsl(var(--visual-reading))]",
    focusRing: "focus-visible:ring-[hsl(var(--visual-reading))]",
  },
  math: {
    solidBg: "bg-[hsl(var(--visual-math))]",
    roleText: "text-[hsl(var(--visual-math))]",
    activeBg: "bg-[hsl(var(--visual-math)/0.12)]",
    activeText: "text-[hsl(var(--visual-math))]",
    focusRing: "focus-visible:ring-[hsl(var(--visual-math))]",
  },
  science: {
    solidBg: "bg-[hsl(var(--visual-science))]",
    roleText: "text-[hsl(var(--visual-science))]",
    activeBg: "bg-[hsl(var(--visual-science)/0.12)]",
    activeText: "text-[hsl(var(--visual-science))]",
    focusRing: "focus-visible:ring-[hsl(var(--visual-science))]",
  },
  primary: {
    solidBg: "bg-[hsl(var(--visual-primary))]",
    roleText: "text-[hsl(var(--visual-primary))]",
    activeBg: "bg-[hsl(var(--visual-primary)/0.12)]",
    activeText: "text-[hsl(var(--visual-primary))]",
    focusRing: "focus-visible:ring-[hsl(var(--visual-primary))]",
  },
};

interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

interface CareTeamLayoutProps {
  children: React.ReactNode;
  accent: keyof typeof ACCENT_TONE;
  roleLabel: string;
  allowedRoles: string[];
  basePath: string;
  navItems?: NavItem[];
  navSections?: NavSection[];
  topNavItems?: NavItem[];
  topNavLabel?: string;
}

export default function CareTeamLayout({ children, accent, roleLabel, allowedRoles, basePath, navItems, navSections, topNavItems, topNavLabel }: CareTeamLayoutProps) {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const tone = ACCENT_TONE[accent];
  const colors = TONE_CLASSES[tone];

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (!loading && user && !allowedRoles.includes(user.role)) router.push("/");
  }, [user, loading, router, allowedRoles]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (loading || !user) return null;

  const isActive = (href: string) => {
    if (href === basePath) return pathname === basePath;
    return pathname.startsWith(href);
  };

  const sidebarContent = (
    <>
      <div className="p-4 border-b vi-border flex items-center justify-between">
        {!collapsed && (
          <Link href={basePath} className="flex items-center gap-3">
            <div className={`w-9 h-9 ${colors.solidBg} rounded-2xl flex items-center justify-center`}>
              <Image src="/images/aivo-logo-white.png" alt="AIVO" width={22} height={22} style={{ height: "auto" }} />
            </div>
            <div>
              <p className="font-bold vi-text text-sm">AIVO</p>
              <p className={`text-xs ${colors.roleText} font-semibold uppercase tracking-wider`}>{roleLabel}</p>
            </div>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="vi-text-muted hover:vi-text p-1 transition hidden md:block"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={16} strokeWidth={2.5} aria-hidden="true" /> : <ChevronLeft size={16} strokeWidth={2.5} aria-hidden="true" />}
        </button>
        <button
          onClick={() => setMobileOpen(false)}
          className="vi-text-muted hover:vi-text p-1 transition md:hidden"
          aria-label="Close navigation menu"
        >
          <X size={18} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {topNavItems && topNavItems.length > 0 && (
          <div className="mb-3">
            {!collapsed && topNavLabel && (
              <p className="px-4 text-xs font-bold vi-text-muted uppercase tracking-wider mb-1">{topNavLabel}</p>
            )}
            {topNavItems.map((item) => {
              const Icon = item.Icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-all mx-2 rounded-2xl focus:outline-none focus-visible:ring-2 ${colors.focusRing} focus-visible:ring-offset-2 ${
                    active
                      ? `${colors.activeBg} ${colors.activeText} font-semibold shadow-sm`
                      : "vi-text-muted hover:vi-surface-soft hover:vi-text"
                  }`}
                  style={{ minHeight: 44 }}
                >
                  <Icon size={18} strokeWidth={2.5} className="flex-shrink-0" aria-hidden="true" />
                  {(!collapsed || mobileOpen) && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>
        )}
        {navSections
          ? navSections.map((section) => (
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
                      className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-all mx-2 rounded-2xl focus:outline-none focus-visible:ring-2 ${colors.focusRing} focus-visible:ring-offset-2 ${
                        active
                          ? `${colors.activeBg} ${colors.activeText} font-semibold shadow-sm`
                          : "vi-text-muted hover:vi-surface-soft hover:vi-text"
                      }`}
                      style={{ minHeight: 44 }}
                    >
                      <Icon size={18} strokeWidth={2.5} className="flex-shrink-0" aria-hidden="true" />
                      {(!collapsed || mobileOpen) && <span>{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            ))
          : (navItems || []).map((item) => {
              const Icon = item.Icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-all mx-2 rounded-2xl focus:outline-none focus-visible:ring-2 ${colors.focusRing} focus-visible:ring-offset-2 ${
                    active
                      ? `${colors.activeBg} ${colors.activeText} font-semibold shadow-sm`
                      : "vi-text-muted hover:vi-surface-soft hover:vi-text"
                  }`}
                  style={{ minHeight: 44 }}
                >
                  <Icon size={18} strokeWidth={2.5} className="flex-shrink-0" aria-hidden="true" />
                  {(!collapsed || mobileOpen) && <span>{item.label}</span>}
                </Link>
              );
            })}
      </nav>

      <div className="p-4 border-t vi-border">
        {(!collapsed || mobileOpen) && (
          <div className="mb-3">
            <p className="text-sm font-semibold vi-text truncate">{user.name}</p>
            <p className="text-xs vi-text-muted">{user.role.replace(/_/g, " ")}</p>
          </div>
        )}
        <button
          onClick={logout}
          aria-label="Sign out"
          className={`inline-flex items-center gap-2 text-xs vi-text-muted hover:text-[hsl(var(--visual-math))] transition ${collapsed && !mobileOpen ? "w-full justify-center" : ""}`}
        >
          <LogOut size={14} strokeWidth={2.5} aria-hidden="true" />
          {(!collapsed || mobileOpen) && <span>Sign Out</span>}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen vi-bg flex">
      <SkipLink />

      {mobileOpen && (
        <div className="fixed inset-0 bg-slate-900/30 z-40 md:hidden" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      )}

      <aside
        id="care-team-sidebar"
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-[hsl(var(--visual-surface))] border-r vi-border flex flex-col
          transition-transform duration-200 motion-reduce:transition-none
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          md:static md:translate-x-0 md:z-auto md:flex-shrink-0
          ${!mobileOpen ? (collapsed ? "md:w-16" : "md:w-64") : ""}
        `}
        role="navigation"
        aria-label={`${roleLabel} sidebar`}
      >
        {sidebarContent}
      </aside>

      <main id="main-content" tabIndex={-1} className="flex-1 overflow-auto flex flex-col min-w-0">
        <div className="md:hidden flex items-center px-4 h-14 border-b vi-border bg-[hsl(var(--visual-surface))]">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={mobileOpen}
            aria-controls="care-team-sidebar"
            className="p-2 vi-text-muted hover:vi-text transition"
            style={{ minHeight: 44, minWidth: 44 }}
          >
            <Menu size={22} strokeWidth={2.5} aria-hidden="true" />
          </button>
          <Link href={basePath} className="ml-3">
            <Image src="/images/aivo-logo-purple.png" alt="AIVO" width={80} height={24} style={{ height: "auto" }} />
          </Link>
        </div>
        <div className="hidden md:block">
          <DashboardHeader
            userName={user.name || roleLabel}
            userRole={user.role}
            userEmail={user.email || undefined}
            accent={accent}
            basePath={basePath}
            baseLabel={roleLabel}
          />
        </div>
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
