import Link from "next/link";
import {
  Home,
  Users,
  Calendar,
  CalendarDays,
  FileText,
  ShieldCheck,
  Bell,
  Settings,
  BarChart3,
  Sparkles,
  BookOpen,
  Wind,
  Trophy,
  GraduationCap,
  ClipboardList,
  Eye,
  MessageCircle,
} from "lucide-react";
import { AivoIcon } from "@aivo/ui/icon";

/**
 * Cookie-free role chrome for `not-found.tsx` / `error.tsx` contexts.
 *
 * The real `AppShell` is an async server component that reads the session,
 * which is exactly why the role 404/error pages used to render as bare
 * white pages. This shell gives a lost user their landmarks back without
 * touching cookies or session.
 *
 * Constraint: error boundaries are CLIENT components, so everything this
 * file imports must be client-bundle-safe. `role-shells.tsx` is not — its
 * graph pulls `@aivo/security` (Node `fs`) — so the boundary nav lives here
 * as plain data. The lockstep unit test (static-role-shell.test.ts, node
 * env) asserts these destinations stay a subset of the real role navs.
 */
export const STATIC_NAV = {
  parent: [
    { href: "/parent/home", label: "Home", icon: Home },
    { href: "/parent/learners", label: "Learners", icon: Users },
    { href: "/parent/schedule", label: "Schedule", icon: Calendar },
    { href: "/parent/calendar", label: "Calendar", icon: CalendarDays },
    { href: "/messages", label: "Messages", icon: MessageCircle },
    { href: "/parent/reports", label: "Reports", icon: FileText },
    { href: "/parent/resources", label: "Resources", icon: BookOpen },
    { href: "/parent/privacy", label: "Privacy", icon: ShieldCheck },
    { href: "/notifications", label: "Notifications", icon: Bell },
    { href: "/parent/settings", label: "Settings", icon: Settings },
  ],
  learner: [
    { href: "/learner/home", label: "Today", icon: Home },
    { href: "/learner/progress", label: "Progress", icon: BarChart3 },
    { href: "/learner/missions", label: "Missions", icon: Sparkles },
    { href: "/learner/library", label: "Library", icon: BookOpen },
    { href: "/learner/calm", label: "Calm", icon: Wind },
    { href: "/learner/rewards", label: "Rewards", icon: Trophy },
    { href: "/learner/settings", label: "Settings", icon: Settings },
  ],
  teacher: [
    { href: "/teacher/home", label: "Home", icon: Home },
    { href: "/teacher/classes", label: "Classes", icon: GraduationCap },
    { href: "/teacher/learners", label: "Learners", icon: Users },
    { href: "/teacher/assignments", label: "Assignments", icon: ClipboardList },
    { href: "/teacher/settings", label: "Settings", icon: Settings },
  ],
  caregiver: [
    { href: "/caregiver/home", label: "Home", icon: Home },
    { href: "/caregiver/learners", label: "Learners", icon: Users },
    { href: "/caregiver/observations", label: "Observations", icon: Eye },
    { href: "/caregiver/settings", label: "Settings", icon: Settings },
  ],
  therapist: [
    { href: "/therapist/home", label: "Home", icon: Home },
    { href: "/therapist/sessions", label: "Sessions", icon: Calendar },
    { href: "/therapist/reports", label: "Reports", icon: FileText },
    { href: "/therapist/settings", label: "Settings", icon: Settings },
  ],
} as const;

export type StaticShellRole = keyof typeof STATIC_NAV;

export function StaticRoleShell({
  role,
  children,
}: {
  role: StaticShellRole;
  children: React.ReactNode;
}) {
  const nav = STATIC_NAV[role];
  return (
    <div className="min-h-screen bg-iw-bg">
      <header className="border-b border-iw-border bg-white px-6 py-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-iw-display text-lg font-bold text-iw-text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring rounded"
        >
          <AivoIcon name="aiSparkle" size={20} />
          AIVO Learning
        </Link>
      </header>
      <div className="mx-auto flex w-full max-w-6xl gap-8 px-6 py-8">
        <nav aria-label="Navigation" className="hidden w-52 shrink-0 flex-col gap-1 sm:flex">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 rounded-iw-control px-3 py-2 text-sm font-medium text-iw-text-muted hover:bg-iw-raised hover:text-iw-text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring"
              >
                <Icon className="h-4 w-4" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
