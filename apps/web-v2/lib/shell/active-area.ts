/**
 * Derive the canonical `NavArea` from a pathname. Used by the shell
 * to set the sidebar's active row and by middleware-style redirects.
 *
 * This is intentionally a flat list of `startsWith` matches because
 * the `@aivo/nav` permission matrix already owns the truth about
 * which path each (role, area) maps to. If you change a route in the
 * matrix, mirror it here.
 */
import type { NavArea } from "@aivo/nav";

const RULES: Array<[NavArea, string[]]> = [
  ["home", ["/learner/home", "/parent/home", "/teacher/home", "/admin/school", "/admin/district", "/admin/platform"]],
  ["learners", ["/parent/learners", "/teacher/learners", "/admin/school/learners", "/admin/district/schools", "/admin/platform/learners"]],
  ["subjects", ["/learner/subjects", "/admin/platform/curriculum"]],
  ["baseline", ["/learner/baseline"]],
  ["lessons", ["/learner/lesson-runs", "/teacher/lesson-plans", "/admin/school/classes"]],
  ["homeworkHelper", ["/learner/homework"]],
  ["aiTutor", ["/learner/quests", "/admin/platform/ai"]],
  ["progress", ["/learner/progress", "/parent/reports", "/teacher/insights"]],
  ["iep", ["/admin/district/iep", "/admin/school/compliance", "/admin/platform/compliance"]],
  ["messages", ["/notifications", "/admin/platform/support"]],
  ["approvals", ["/parent/consent", "/teacher/assignments"]],
  ["billing", ["/parent/settings/billing", "/admin/school/billing", "/admin/district/billing", "/admin/platform/billing"]],
  ["admin", ["/admin/school/staff", "/admin/district/schools", "/admin/platform/tenants"]],
  ["safety", ["/admin/platform/safety", "/admin/school/compliance", "/admin/district/compliance"]],
  ["reports", ["/teacher/reports", "/admin/school/reports", "/admin/district/reports", "/admin/platform/system-health"]],
  ["settings", ["/settings", "/learner/settings", "/parent/settings", "/teacher/settings", "/admin/school/settings", "/admin/district/settings", "/admin/platform/settings"]],
];

export function activeAreaFromPath(pathname: string): NavArea | undefined {
  for (const [area, prefixes] of RULES) {
    for (const p of prefixes) {
      if (pathname === p || pathname.startsWith(p + "/")) return area;
    }
  }
  return undefined;
}
