import type { NavArea } from "./areas.js";
import type { Role } from "./roles.js";

/**
 * Per-role permission and route binding for one navigation area.
 */
export interface NavPermission {
  /**
   * - `full`   — role uses this area as a primary destination; appears in
   *              sidebar / bottom tabs.
   * - `linked` — role has access but it lives in a sub-menu, not the
   *              primary nav (e.g. parent → settings).
   * - `locked` — role can see the area exists but cannot enter; shows a
   *              locked-state screen explaining why.
   * - `hidden` — area is not relevant for the role; never shown.
   */
  access: "full" | "linked" | "locked" | "hidden";
  /**
   * Route the shell links to when {@link access} is `full` or `linked`.
   * Templated with `:role` and `:learnerId` etc., resolved by the
   * `resolveRoute()` helper in `routes.ts`.
   */
  webRoute?: string;
  mobileRoute?: string;
  /**
   * Human-readable reason shown on the locked screen. Required when
   * {@link access} === `locked`.
   */
  lockReason?: string;
  /** Optional CTA shown on the locked screen (label + href). */
  lockCta?: { label: string; href?: string };
}

type Matrix = Record<Role, Partial<Record<NavArea, NavPermission>>>;

/**
 * Default value when a role / area pair is not explicitly listed.
 */
const HIDDEN: NavPermission = { access: "hidden" };

/**
 * Source of truth for every shell link. Read by:
 *   - `getNavForRole()` to build sidebar + bottom tabs
 *   - `<LockedScreen>` to render explanations
 *   - `<RoleSwitcher>` to disable irrelevant roles
 *   - `middleware.ts` to redirect dead routes to `/locked/[area]`
 */
const MATRIX: Matrix = {
  /* ───────────────────────────── Learner ───────────────────────────── */
  learner: {
    home: { access: "full", webRoute: "/learner/home", mobileRoute: "/(learner)/home" },
    subjects: {
      access: "full",
      webRoute: "/learner/subjects",
      mobileRoute: "/(learner)/subjects",
    },
    lessons: {
      access: "full",
      webRoute: "/learner/lesson-runs",
      mobileRoute: "/(learner)/lessons",
    },
    homeworkHelper: {
      access: "full",
      webRoute: "/learner/homework",
      mobileRoute: "/(learner)/homework",
    },
    aiTutor: {
      access: "full",
      webRoute: "/learner/quests",
      mobileRoute: "/(learner)/tutor",
    },
    progress: {
      access: "full",
      webRoute: "/learner/progress",
      mobileRoute: "/(learner)/progress",
    },
    baseline: {
      access: "linked",
      webRoute: "/learner/baseline",
      mobileRoute: "/(learner)/baseline",
    },
    settings: {
      access: "linked",
      webRoute: "/learner/settings",
      mobileRoute: "/(learner)/settings",
    },
    messages: {
      access: "linked",
      webRoute: "/learner/notifications",
      mobileRoute: "/(learner)/messages",
    },
    iep: {
      access: "locked",
      lockReason:
        "Your IEP and supports are visible to your parent and teacher. Ask them if you have questions about your accommodations.",
    },
    billing: {
      access: "locked",
      lockReason: "Only the grown-up on your account can see billing.",
    },
    approvals: {
      access: "locked",
      lockReason: "A parent approves new content for you.",
    },
    admin: HIDDEN,
    safety: HIDDEN,
    reports: HIDDEN,
    learners: HIDDEN,
  },

  /* ───────────────────────────── Parent ────────────────────────────── */
  parent: {
    home: { access: "full", webRoute: "/parent/home", mobileRoute: "/(parent)/home" },
    learners: {
      access: "full",
      webRoute: "/parent/learners",
      mobileRoute: "/(parent)/learners",
    },
    progress: {
      access: "full",
      webRoute: "/parent/reports",
      mobileRoute: "/(parent)/progress",
    },
    approvals: {
      access: "full",
      webRoute: "/parent/consent",
      mobileRoute: "/(parent)/approvals",
    },
    messages: {
      access: "full",
      webRoute: "/parent/notifications",
      mobileRoute: "/(parent)/messages",
    },
    iep: {
      access: "linked",
      webRoute: "/parent/learners",
      mobileRoute: "/(parent)/iep",
    },
    billing: {
      access: "linked",
      webRoute: "/parent/settings/billing",
      mobileRoute: "/(parent)/billing",
    },
    settings: {
      access: "linked",
      webRoute: "/parent/settings",
      mobileRoute: "/(parent)/settings",
    },
    subjects: {
      access: "linked",
      webRoute: "/parent/learners",
      mobileRoute: "/(parent)/subjects",
    },
    baseline: {
      access: "locked",
      lockReason:
        "Baselines are run by your child's teacher. You'll see results in Progress once they are complete.",
      lockCta: { label: "Open Progress", href: "/parent/reports" },
    },
    homeworkHelper: {
      access: "locked",
      lockReason:
        "Homework Helper is your child's tool. You can supervise sessions from Approvals.",
      lockCta: { label: "Open Approvals", href: "/parent/consent" },
    },
    aiTutor: {
      access: "locked",
      lockReason:
        "AI Tutor sessions belong to your child. Review transcripts from each learner's profile.",
    },
    lessons: {
      access: "linked",
      webRoute: "/parent/schedule",
      mobileRoute: "/(parent)/lessons",
    },
    admin: HIDDEN,
    safety: {
      access: "locked",
      lockReason:
        "Safety reviews are handled by school staff and AIVO. We will message you if anything needs your attention.",
    },
    reports: {
      access: "linked",
      webRoute: "/parent/reports",
      mobileRoute: "/(parent)/reports",
    },
  },

  /* ───────────────────────────── Teacher ───────────────────────────── */
  teacher: {
    home: { access: "full", webRoute: "/teacher/home", mobileRoute: "/(teacher)/home" },
    learners: {
      access: "full",
      webRoute: "/teacher/learners",
      mobileRoute: "/(teacher)/learners",
    },
    lessons: {
      access: "full",
      webRoute: "/teacher/lesson-plans",
      mobileRoute: "/(teacher)/lessons",
    },
    progress: {
      access: "full",
      webRoute: "/teacher/insights",
      mobileRoute: "/(teacher)/progress",
    },
    messages: {
      access: "full",
      webRoute: "/teacher/learners",
      mobileRoute: "/(teacher)/messages",
    },
    subjects: {
      access: "linked",
      webRoute: "/teacher/lesson-plans",
      mobileRoute: "/(teacher)/subjects",
    },
    baseline: {
      access: "linked",
      webRoute: "/teacher/assignments",
      mobileRoute: "/(teacher)/baseline",
    },
    iep: {
      access: "linked",
      webRoute: "/teacher/learners",
      mobileRoute: "/(teacher)/iep",
    },
    approvals: {
      access: "linked",
      webRoute: "/teacher/assignments",
      mobileRoute: "/(teacher)/approvals",
    },
    reports: {
      access: "linked",
      webRoute: "/teacher/reports",
      mobileRoute: "/(teacher)/reports",
    },
    settings: {
      access: "linked",
      webRoute: "/teacher/settings",
      mobileRoute: "/(teacher)/settings",
    },
    homeworkHelper: {
      access: "locked",
      lockReason:
        "Homework Helper is a learner-facing tool. You can review session transcripts from each student's profile.",
    },
    aiTutor: {
      access: "locked",
      lockReason:
        "AI Tutor conversations belong to learners. Open a student profile to read their transcripts.",
    },
    billing: {
      access: "locked",
      lockReason: "Billing is handled by your school admin.",
    },
    safety: {
      access: "linked",
      webRoute: "/teacher/learners",
      mobileRoute: "/(teacher)/safety",
    },
    admin: HIDDEN,
  },

  /* ─────────────────────────── School admin ────────────────────────── */
  schoolAdmin: {
    home: {
      access: "full",
      webRoute: "/admin/school",
      mobileRoute: "/(parent)/home",
    },
    learners: {
      access: "full",
      webRoute: "/admin/school/learners",
      mobileRoute: "/(parent)/learners",
    },
    admin: {
      access: "full",
      webRoute: "/admin/school/staff",
      mobileRoute: "/(parent)/admin",
    },
    reports: {
      access: "full",
      webRoute: "/admin/school/reports",
      mobileRoute: "/(parent)/reports",
    },
    billing: {
      access: "full",
      webRoute: "/admin/school/billing",
      mobileRoute: "/(parent)/billing",
    },
    safety: {
      access: "linked",
      webRoute: "/admin/school/compliance",
      mobileRoute: "/(parent)/safety",
    },
    iep: {
      access: "linked",
      webRoute: "/admin/school/compliance",
      mobileRoute: "/(parent)/iep",
    },
    messages: {
      access: "linked",
      webRoute: "/admin/school/staff",
    },
    subjects: {
      access: "linked",
      webRoute: "/admin/school/classes",
    },
    settings: {
      access: "linked",
      webRoute: "/admin/school/settings",
    },
    approvals: {
      access: "linked",
      webRoute: "/admin/school/compliance",
    },
    progress: {
      access: "linked",
      webRoute: "/admin/school/reports",
    },
    baseline: { access: "linked", webRoute: "/admin/school/reports" },
    lessons: { access: "linked", webRoute: "/admin/school/classes" },
    homeworkHelper: {
      access: "locked",
      lockReason: "Homework Helper is learner-only. Use Reports for aggregate usage data.",
    },
    aiTutor: {
      access: "locked",
      lockReason: "AI Tutor sessions are private to learners. Use Reports for aggregate usage data.",
    },
  },

  /* ────────────────────────── District admin ───────────────────────── */
  districtAdmin: {
    home: { access: "full", webRoute: "/admin/district" },
    admin: { access: "full", webRoute: "/admin/district/schools" },
    reports: { access: "full", webRoute: "/admin/district/reports" },
    billing: { access: "full", webRoute: "/admin/district/billing" },
    iep: { access: "full", webRoute: "/admin/district/iep" },
    safety: {
      access: "linked",
      webRoute: "/admin/district/compliance",
    },
    settings: { access: "linked", webRoute: "/admin/district/settings" },
    learners: { access: "linked", webRoute: "/admin/district/schools" },
    messages: { access: "linked", webRoute: "/admin/district/staff" },
    approvals: { access: "linked", webRoute: "/admin/district/compliance" },
    progress: { access: "linked", webRoute: "/admin/district/reports" },
    baseline: { access: "linked", webRoute: "/admin/district/reports" },
    lessons: { access: "linked", webRoute: "/admin/district/schools" },
    subjects: { access: "linked", webRoute: "/admin/district/schools" },
    homeworkHelper: {
      access: "locked",
      lockReason: "Homework Helper is a learner tool. District-level usage lives in Reports.",
    },
    aiTutor: {
      access: "locked",
      lockReason: "AI Tutor sessions are private to learners. District-level usage lives in Reports.",
    },
  },

  /* ──────────────────────────── Internal ───────────────────────────── */
  internal: {
    home: { access: "full", webRoute: "/admin/platform" },
    admin: { access: "full", webRoute: "/admin/platform/tenants" },
    learners: { access: "full", webRoute: "/admin/platform/learners" },
    safety: { access: "full", webRoute: "/admin/platform/safety" },
    reports: { access: "full", webRoute: "/admin/platform/system-health" },
    billing: { access: "full", webRoute: "/admin/platform/billing" },
    settings: { access: "linked", webRoute: "/admin/platform/settings" },
    iep: { access: "linked", webRoute: "/admin/platform/compliance" },
    messages: { access: "linked", webRoute: "/admin/platform/support" },
    approvals: { access: "linked", webRoute: "/admin/platform/compliance" },
    subjects: { access: "linked", webRoute: "/admin/platform/curriculum" },
    lessons: { access: "linked", webRoute: "/admin/platform/curriculum" },
    baseline: { access: "linked", webRoute: "/admin/platform/ai" },
    progress: { access: "linked", webRoute: "/admin/platform/system-health" },
    homeworkHelper: { access: "linked", webRoute: "/admin/platform/ai" },
    aiTutor: { access: "linked", webRoute: "/admin/platform/ai" },
  },
};

/**
 * Look up the permission record for a (role, area) pair. Always returns
 * a value; defaults to `{ access: "hidden" }` for combinations that are
 * not in the matrix.
 */
export function getPermission(role: Role, area: NavArea): NavPermission {
  return MATRIX[role][area] ?? HIDDEN;
}

/**
 * True if the role has a navigable destination for this area (full or
 * linked access). Use this to decide whether a link should render at all.
 */
export function hasAccess(role: Role, area: NavArea): boolean {
  const p = getPermission(role, area);
  return p.access === "full" || p.access === "linked";
}

/**
 * Returns a stable, ordered list of the areas a role can see — `full`
 * first (primary nav), then `linked` (secondary nav), then `locked`
 * (shown only in role-aware "see what else is here" surfaces).
 */
export function getAreasForRole(role: Role, opts?: { includeLocked?: boolean }): NavArea[] {
  const include = opts?.includeLocked ?? false;
  const allowed: Array<{ area: NavArea; rank: number }> = [];
  // Preserve the canonical NAV_AREAS ordering rather than object-key order.
  // We re-import lazily to keep this file free of circular hazards.
  const order: NavArea[] = [
    "home",
    "learners",
    "subjects",
    "baseline",
    "lessons",
    "homeworkHelper",
    "aiTutor",
    "progress",
    "iep",
    "messages",
    "approvals",
    "billing",
    "settings",
    "admin",
    "safety",
    "reports",
  ];
  for (const area of order) {
    const p = getPermission(role, area);
    if (p.access === "full") allowed.push({ area, rank: 0 });
    else if (p.access === "linked") allowed.push({ area, rank: 1 });
    else if (include && p.access === "locked") allowed.push({ area, rank: 2 });
  }
  return allowed.sort((a, b) => a.rank - b.rank).map((x) => x.area);
}

/**
 * Areas a role uses as primary destinations — what should render in the
 * top of the sidebar / as bottom tabs on mobile.
 */
export function getPrimaryAreas(role: Role): NavArea[] {
  return (Object.keys(MATRIX[role]) as NavArea[]).filter(
    (a) => MATRIX[role][a]?.access === "full",
  );
}

export { MATRIX as _MATRIX };
