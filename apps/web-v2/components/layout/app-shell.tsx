import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { RoleNav, type RoleNavItem } from "@/components/layout/role-nav";
import { logoutAction } from "@/lib/auth/actions";
import { SensoryModeToggle } from "@/components/system/sensory-mode-provider";
import { cn } from "@/lib/utils";

/**
 * Map a session role to the visual theme it should render under.
 * Theme tokens live in app/globals.css under `[data-role-theme="…"]` rules; this
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
 * CSS variables — copy tone and the sidebar header treatment.
 *
 * In the Inclusive-Warm rollout, all five themes share the same purple
 * wordmark mark in the top bar (drawn from `INCLUSIVE_WARM_LOGOS.purple`).
 * Only the eyebrow copy and the sidebar contrast tone change per role.
 */
const THEME_CHROME: Record<
  ReturnType<typeof roleToTheme>,
  { eyebrow: string; sidebarTone: "light" | "dark" }
> = {
  parent: { eyebrow: "Family workspace", sidebarTone: "light" },
  learner: { eyebrow: "Today's adventure", sidebarTone: "dark" },
  teacher: { eyebrow: "Classroom console", sidebarTone: "light" },
  admin: { eyebrow: "School operations", sidebarTone: "light" },
  platform: { eyebrow: "Platform ops", sidebarTone: "dark" },
};

/**
 * App shell for every signed-in dashboard.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │  Top bar: AIVO wordmark · eyebrow · sensory toggle · user    │
 *   ├────────────┬─────────────────────────────────────────────────┤
 *   │  Sidebar   │  <main id="main">  …page content…  </main>      │
 *   │  RoleNav   │                                                 │
 *   └────────────┴─────────────────────────────────────────────────┘
 *
 * The Inclusive-Warm chrome is intentionally driven by `iw-*` Tailwind
 * tokens so the sensory toggle in the top bar repaints the whole shell
 * (page bg, card surfaces, ring focus, etc.) the moment the user clicks
 * it — no per-page wiring required.
 */
export function AppShell({
  role,
  roleLabel,
  navItems,
  user,
  children,
  variant = "standard",
}: {
  role: string;
  roleLabel: string;
  navItems: RoleNavItem[];
  user: { displayName: string; email: string };
  children: React.ReactNode;
  /**
   * `immersive` hides the nav rail so the page can render its own
   * workspace rail (used by the SensoryAdaptive learner home, where
   * the rail is a sensory-preferences panel rather than nav).
   */
  variant?: "standard" | "immersive";
}) {
  const theme = roleToTheme(role);
  const chrome = THEME_CHROME[theme];
  const isDarkSidebar = chrome.sidebarTone === "dark";
  const immersive = variant === "immersive";

  return (
    <div data-role-theme={theme} data-role={role} className="min-h-screen bg-iw-bg text-iw-ink">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      {/* Top bar — present on every dashboard. */}
      <header
        className="sticky top-0 z-40 border-b border-iw-border bg-iw-raised/85 backdrop-blur"
        aria-label="Application header"
      >
        <div
          className={cn(
            "mx-auto flex h-16 items-center gap-4 px-4 sm:px-6",
            theme === "learner" ? "max-w-[1200px]" : "max-w-[1400px]",
          )}
        >
          <Link
            href="/"
            aria-label="AIVO Learning home"
            className="inline-flex items-center rounded-full px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring"
          >
            <Image
              src="/images/aivo-logo-purple.png"
              alt="AIVO Learning"
              width={160}
              height={48}
              priority
              className="h-9 w-auto"
            />
          </Link>

          <span
            className="hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-iw-ink-muted sm:inline"
            aria-hidden
          >
            · {chrome.eyebrow}
          </span>

          <div className="ml-auto flex items-center gap-3">
            {immersive ? null : <SensoryModeToggle size="sm" />}
            <span className="hidden text-right sm:block">
              <span className="block text-sm font-semibold leading-tight text-iw-ink">
                {user.displayName}
              </span>
              <span className="block text-[11px] leading-tight text-iw-ink-muted">{roleLabel}</span>
            </span>
            <span
              aria-hidden
              className="grid h-9 w-9 place-items-center rounded-full bg-iw-accent-soft text-sm font-bold text-iw-accent"
              title={user.displayName}
            >
              {user.displayName.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      </header>

      <div
        className={cn(
          "mx-auto grid grid-cols-1 gap-6 px-4 py-6 sm:px-6",
          !immersive && "md:grid-cols-[240px_1fr] lg:grid-cols-[260px_1fr]",
          theme === "learner" ? "max-w-[1280px]" : "max-w-[1400px]",
        )}
      >
        {immersive ? null : (
        <aside
          aria-label={`${roleLabel} navigation`}
          className={cn(
            "h-fit rounded-iw-card p-4 shadow-sm md:sticky md:top-[88px]",
            isDarkSidebar
              ? "border border-[color:var(--color-aivo-sidebar-border)]"
              : "border border-iw-border bg-iw-card",
          )}
          style={
            isDarkSidebar
              ? {
                  background: "var(--color-aivo-sidebar-bg)",
                  color: "var(--color-aivo-sidebar-fg)",
                }
              : undefined
          }
        >
          <p
            className="px-2 pb-3 text-[10px] font-semibold uppercase tracking-[0.16em]"
            style={isDarkSidebar ? { color: "var(--color-aivo-sidebar-muted)" } : undefined}
          >
            {roleLabel}
          </p>
          <RoleNav items={navItems} ariaLabel={`${roleLabel} sections`} />
          <div
            className="mt-6 border-t pt-4"
            style={{
              borderColor: isDarkSidebar ? "var(--color-aivo-sidebar-border)" : undefined,
            }}
          >
            <p className="px-2 text-sm font-medium">{user.displayName}</p>
            <p
              className="px-2 text-xs"
              style={isDarkSidebar ? { color: "var(--color-aivo-sidebar-muted)" } : undefined}
            >
              {user.email}
            </p>
            <Link
              href="/settings/accessibility"
              className={cn(
                "mt-2 block rounded-lg px-2 py-1 text-xs",
                isDarkSidebar ? "hover:bg-white/10" : "text-iw-ink-muted hover:bg-iw-raised",
              )}
              style={isDarkSidebar ? { color: "var(--color-aivo-sidebar-muted)" } : undefined}
            >
              Accessibility settings
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className={cn(
                  "mt-1 block w-full rounded-lg px-2 py-1 text-left text-xs",
                  isDarkSidebar ? "hover:bg-white/10" : "text-iw-ink-muted hover:bg-iw-raised",
                )}
                style={isDarkSidebar ? { color: "var(--color-aivo-sidebar-muted)" } : undefined}
              >
                Sign out
              </button>
            </form>
          </div>
        </aside>
        )}

        <main id="main" data-role={role} className="min-w-0">
          {children}
        </main>
      </div>

      <footer className="border-t border-iw-border bg-iw-raised">
        <div
          className={cn(
            "mx-auto flex flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-iw-ink-muted sm:px-6",
            theme === "learner" ? "max-w-[1200px]" : "max-w-[1400px]",
          )}
        >
          <span>© Aivo Learning. Personalized adventures for every child.</span>
          <span>COPPA · FERPA · SOC 2</span>
        </div>
      </footer>
    </div>
  );
}
