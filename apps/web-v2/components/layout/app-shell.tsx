import * as React from "react";
import Link from "next/link";
import { RoleNav, type RoleNavItem } from "@/components/layout/role-nav";
import { logoutAction } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

/**
 * Map a session role to the visual theme it should render under.
 * Theme tokens live in app/globals.css under `[data-theme="…"]` rules; this
 * lets us differentiate parent / learner / teacher / admin / platform without
 * editing every page that calls AppShell.
 */
function roleToTheme(role: string): "parent" | "learner" | "teacher" | "admin" | "platform" {
  if (role === "learner") return "learner";
  if (role === "teacher") return "teacher";
  if (role === "platform_admin") return "platform";
  if (role === "school_admin" || role === "district_admin") return "admin";
  return "parent";
}

/**
 * Per-theme chrome overrides for things that can't be expressed as pure
 * CSS variables — copy tone, logo glyph, and the sidebar header treatment.
 * Keeping these in one map (rather than five forks of AppShell) keeps the
 * single source of truth for layout intact.
 */
const THEME_CHROME: Record<
  ReturnType<typeof roleToTheme>,
  { logoGlyph: string; logoBg: string; eyebrow: string; sidebarTone: "light" | "dark" }
> = {
  parent: {
    logoGlyph: "A",
    logoBg: "bg-aivo-primary text-aivo-primary-fg",
    eyebrow: "Family workspace",
    sidebarTone: "light",
  },
  learner: {
    logoGlyph: "★",
    logoBg: "bg-white text-aivo-primary",
    eyebrow: "Today's adventure",
    sidebarTone: "dark",
  },
  teacher: {
    logoGlyph: "A",
    logoBg: "bg-aivo-primary text-aivo-primary-fg",
    eyebrow: "Classroom console",
    sidebarTone: "light",
  },
  admin: {
    logoGlyph: "A",
    logoBg: "bg-aivo-primary text-aivo-primary-fg",
    eyebrow: "School operations",
    sidebarTone: "light",
  },
  platform: {
    logoGlyph: "A",
    logoBg: "bg-aivo-primary text-aivo-primary-fg",
    eyebrow: "Platform ops",
    sidebarTone: "dark",
  },
};

export function AppShell({
  role,
  roleLabel,
  navItems,
  user,
  children,
}: {
  role: string;
  roleLabel: string;
  navItems: RoleNavItem[];
  user: { displayName: string; email: string };
  children: React.ReactNode;
}) {
  const theme = roleToTheme(role);
  const chrome = THEME_CHROME[theme];
  const isDarkSidebar = chrome.sidebarTone === "dark";

  return (
    <div
      data-theme={theme}
      data-role={role}
      className="min-h-screen"
      style={{ background: "var(--color-aivo-page-bg)" }}
    >
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <div
        className={cn(
          "mx-auto grid grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[260px_1fr]",
          // Learner mode trades width for one-task focus per UX guidelines.
          theme === "learner" ? "max-w-[1200px]" : "max-w-[1400px]",
        )}
      >
        <aside
          aria-label={`${roleLabel} navigation`}
          className={cn(
            "rounded-[var(--radius-card)] p-4 shadow-sm h-fit lg:sticky lg:top-6",
            isDarkSidebar
              ? "border border-[var(--color-aivo-sidebar-border)]"
              : "border border-aivo-border",
          )}
          style={{
            background: "var(--color-aivo-sidebar-bg)",
            color: "var(--color-aivo-sidebar-fg)",
          }}
        >
          <Link href="/" className="flex items-center gap-2 px-2 pb-4">
            <span
              aria-hidden
              className={cn(
                "grid place-items-center rounded-full font-bold",
                theme === "learner" ? "h-10 w-10 text-xl" : "h-8 w-8",
                chrome.logoBg,
              )}
            >
              {chrome.logoGlyph}
            </span>
            <span className="font-display text-lg font-semibold">AIVO</span>
          </Link>
          <p
            className="px-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: "var(--color-aivo-sidebar-muted)" }}
          >
            {chrome.eyebrow}
          </p>
          <p className="px-2 text-xs font-semibold uppercase tracking-wide">{roleLabel}</p>
          <div className="mt-2">
            <RoleNav items={navItems} ariaLabel={`${roleLabel} sections`} />
          </div>
          <div
            className="mt-6 border-t pt-4"
            style={{ borderColor: "var(--color-aivo-sidebar-border)" }}
          >
            <p className="px-2 text-sm font-medium">{user.displayName}</p>
            <p className="px-2 text-xs" style={{ color: "var(--color-aivo-sidebar-muted)" }}>
              {user.email}
            </p>
            <Link
              href="/settings/accessibility"
              className={cn(
                "mt-2 block rounded-lg px-2 py-1 text-xs hover:bg-aivo-surface-2",
                isDarkSidebar && "hover:bg-white/10",
              )}
              style={{ color: "var(--color-aivo-sidebar-muted)" }}
            >
              Accessibility settings
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className={cn(
                  "mt-1 block w-full rounded-lg px-2 py-1 text-left text-xs hover:bg-aivo-surface-2",
                  isDarkSidebar && "hover:bg-white/10",
                )}
                style={{ color: "var(--color-aivo-sidebar-muted)" }}
              >
                Sign out
              </button>
            </form>
          </div>
        </aside>
        <main id="main" data-role={role} className="min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
