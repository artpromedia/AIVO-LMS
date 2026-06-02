import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu } from "lucide-react";
import { RoleNav, type RoleNavItem } from "@/components/layout/role-nav";
import { logoutAction } from "@/lib/auth/actions";
import { SensoryModePopover } from "@/components/system/sensory-mode-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerTrigger, DrawerContent } from "@/components/ui/drawer";
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
 * Shared sidebar body. Rendered in two places:
 *   - inline as a sticky `<aside>` on md+
 *   - inside the mobile `<Drawer>` on small viewports.
 * Keeps a single source of truth for navigation + user block.
 */
function SidebarBody({
  navItems,
  ariaLabel,
  user,
  isDarkSidebar,
}: {
  readonly navItems: RoleNavItem[];
  readonly ariaLabel: string;
  readonly user: { displayName: string; email: string };
  readonly isDarkSidebar: boolean;
}) {
  return (
    <>
      <RoleNav items={navItems} ariaLabel={ariaLabel} />
      <div
        className="mt-6 flex flex-col gap-2 border-t pt-4"
        style={{
          borderColor: isDarkSidebar ? "var(--color-aivo-sidebar-border)" : undefined,
        }}
      >
        <div className="flex items-center gap-3 px-2">
          <Avatar name={user.displayName} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight">{user.displayName}</p>
            <p
              className="truncate text-xs leading-tight"
              style={isDarkSidebar ? { color: "var(--color-aivo-sidebar-muted)" } : undefined}
              title={user.email}
            >
              {user.email}
            </p>
          </div>
        </div>
        <div className="mt-1 flex flex-col gap-1">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-8 justify-start px-2 text-xs font-medium"
          >
            <Link href="/settings/accessibility">Accessibility settings</Link>
          </Button>
          <form action={logoutAction}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="h-8 w-full justify-start px-2 text-xs font-medium"
            >
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}

/**
 * App shell for every signed-in dashboard.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │  Top bar: ☰ · AIVO wordmark · sensory popover · user chip    │
 *   │           (☰ visible only below md; opens the sidebar in a   │
 *   │           drawer for one-handed phone / narrow-tablet use.)  │
 *   ├────────────┬─────────────────────────────────────────────────┤
 *   │  Sidebar   │  <main id="main">  …page content…  </main>      │
 *   │  (md+)     │                                                 │
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
  topBarSlot,
  jobTray,
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
  /**
   * Optional element rendered in the top bar, just before the
   * profile/avatar cluster. The learner shell uses this for the
   * persistent "living brain" indicator.
   */
  topBarSlot?: React.ReactNode;
  /**
   * Optional fixed overlay element rendered after the page body.
   * Used by school_admin pages to show the import job-tray component.
   * Kept fully additive — all non-school-admin pages omit this prop
   * and are unaffected.
   */
  jobTray?: React.ReactNode;
}) {
  const theme = roleToTheme(role);
  const chrome = THEME_CHROME[theme];
  const isDarkSidebar = chrome.sidebarTone === "dark";
  const immersive = variant === "immersive";
  const navAriaLabel = `${roleLabel} sections`;
  const _eyebrow = chrome.eyebrow; // retained for future header pass

  const sidebarStyle = isDarkSidebar
    ? {
        background: "var(--color-aivo-sidebar-bg)",
        color: "var(--color-aivo-sidebar-fg)",
      }
    : undefined;

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
            "mx-auto flex h-16 items-center gap-2 px-4 sm:gap-4 sm:px-6",
            theme === "learner" ? "max-w-[1200px]" : "max-w-[1400px]",
          )}
        >
          {/* Mobile-only nav trigger — opens the sidebar in a drawer.
              Hidden on md+ where the sidebar is always visible. */}
          {!immersive && (
            <Drawer>
              <DrawerTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="md:hidden -ml-2"
                  aria-label={`Open ${roleLabel} navigation`}
                >
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </Button>
              </DrawerTrigger>
              <DrawerContent
                side="left"
                className={cn("p-5", isDarkSidebar ? "" : "bg-iw-card")}
                style={sidebarStyle}
              >
                <SidebarBody
                  navItems={navItems}
                  ariaLabel={navAriaLabel}
                  user={user}
                  isDarkSidebar={isDarkSidebar}
                />
              </DrawerContent>
            </Drawer>
          )}

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

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {topBarSlot}
            {immersive ? null : <SensoryModePopover />}
            {immersive ? null : <LanguageSwitcher />}
            <span className="hidden text-right sm:block">
              <span className="block text-sm font-semibold leading-tight text-iw-ink">
                {user.displayName}
              </span>
              <span className="block text-[11px] leading-tight text-iw-ink-muted">{roleLabel}</span>
            </span>
            <Avatar name={user.displayName} size="md" />
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
          /* Sticky sidebar on md+ only. On smaller viewports the same
             content lives behind the top-bar drawer above. */
          <aside
            aria-label={`${roleLabel} navigation`}
            className={cn(
              "hidden md:block h-fit rounded-iw-card p-4 shadow-sm md:sticky md:top-[88px]",
              isDarkSidebar
                ? "border border-[color:var(--color-aivo-sidebar-border)]"
                : "border border-iw-border bg-iw-card",
            )}
            style={sidebarStyle}
          >
            <SidebarBody
              navItems={navItems}
              ariaLabel={navAriaLabel}
              user={user}
              isDarkSidebar={isDarkSidebar}
            />
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

      {/* Job-tray overlay — rendered outside the layout flow so it floats
          over content regardless of scroll position. Only present when the
          page opts in via the `jobTray` prop (school_admin pages only). */}
      {jobTray}
    </div>
  );
}
