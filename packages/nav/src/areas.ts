/**
 * Canonical navigation areas. Every shell button, tab, sidebar row,
 * breadcrumb anchor, and locked-state screen is keyed off these IDs.
 *
 * Do not invent new top-level navigation outside this list — add an
 * area here first, then route it in {@link ./routes.ts}.
 */
export type NavArea =
  | "home"
  | "learners"
  | "subjects"
  | "baseline"
  | "lessons"
  | "homeworkHelper"
  | "aiTutor"
  | "progress"
  | "iep"
  | "messages"
  | "approvals"
  | "billing"
  | "settings"
  | "admin"
  | "safety"
  | "reports";

export const NAV_AREAS: readonly NavArea[] = [
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
] as const;

/**
 * One of nine domain icon tones from the AivoIcon palette. Kept as a
 * string so this package stays React-free; the shell maps it to an
 * `<AivoIcon name=… />` component.
 */
export type NavIconName =
  | "aiBrain"
  | "aiSparkle"
  | "aiWand"
  | "curriculum"
  | "classroom"
  | "library"
  | "mastery"
  | "goal"
  | "growth"
  | "iep"
  | "plan"
  | "care"
  | "safetyOk"
  | "safetyAlert"
  | "safetyFlag"
  | "billingCard"
  | "billingReceipt"
  | "billingWallet"
  | "rosterStudents"
  | "rosterSchool"
  | "rosterDistrict"
  | "consentCheck"
  | "consentDoc"
  | "consentLock";

export interface NavAreaMeta {
  id: NavArea;
  label: string;
  /** AivoIcon name; the shell translates this into a real icon. */
  icon: NavIconName;
  /** One-line description for the sidebar tooltip and locked screens. */
  description: string;
}

export const NAV_AREA_META: Record<NavArea, NavAreaMeta> = {
  home: {
    id: "home",
    label: "Home",
    icon: "aiSparkle",
    description: "Your daily overview.",
  },
  learners: {
    id: "learners",
    label: "Learners",
    icon: "rosterStudents",
    description: "The students you are responsible for.",
  },
  subjects: {
    id: "subjects",
    label: "Subjects",
    icon: "library",
    description: "Curriculum, courses, and standards.",
  },
  baseline: {
    id: "baseline",
    label: "Baseline",
    icon: "goal",
    description: "Diagnostic baselines and starting points.",
  },
  lessons: {
    id: "lessons",
    label: "Lessons",
    icon: "curriculum",
    description: "Today's lessons and lesson plans.",
  },
  homeworkHelper: {
    id: "homeworkHelper",
    label: "Homework Helper",
    icon: "aiWand",
    description: "Guided homework with the AI helper.",
  },
  aiTutor: {
    id: "aiTutor",
    label: "AI Tutor",
    icon: "aiBrain",
    description: "Conversational tutor for any subject.",
  },
  progress: {
    id: "progress",
    label: "Progress",
    icon: "growth",
    description: "Mastery, streaks, and goals.",
  },
  iep: {
    id: "iep",
    label: "IEP / Supports",
    icon: "iep",
    description: "IEPs, 504s, and accommodations.",
  },
  messages: {
    id: "messages",
    label: "Messages",
    icon: "plan",
    description: "Messages with teachers, families, and AIVO.",
  },
  approvals: {
    id: "approvals",
    label: "Approvals",
    icon: "consentCheck",
    description: "Pending consents and content approvals.",
  },
  billing: {
    id: "billing",
    label: "Billing",
    icon: "billingCard",
    description: "Subscriptions, invoices, and payment methods.",
  },
  settings: {
    id: "settings",
    label: "Settings",
    icon: "care",
    description: "Account, privacy, and accessibility.",
  },
  admin: {
    id: "admin",
    label: "Admin",
    icon: "rosterSchool",
    description: "Roster, staff, classes, and compliance.",
  },
  safety: {
    id: "safety",
    label: "Safety",
    icon: "safetyOk",
    description: "Safety signals, escalations, and reviews.",
  },
  reports: {
    id: "reports",
    label: "Reports",
    icon: "mastery",
    description: "Outcomes, attendance, and compliance reports.",
  },
};
