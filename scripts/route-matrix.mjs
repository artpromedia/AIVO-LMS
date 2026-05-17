#!/usr/bin/env node
/**
 * Regenerates docs/ux/UX-01-route-matrix.json by walking apps/web-v2/app
 * for page.tsx files and pairing each implemented route with role,
 * permission, consent, state, and priority defaults derived from UX-01.
 *
 * Hand-curated lists:
 *   - MOBILE_SCREENS: target unified-app screens (UX-01 §2 / §7).
 *   - PLANNED_ROUTES: web routes called out as ★ in UX-01 §1.
 *   - CONSENT_BY_PATH: explicit consent dependencies (UX-01 §6).
 *
 * Run: node scripts/route-matrix.mjs
 */
import fs from "node:fs";
import path from "node:path";

const APP_ROOT = "apps/web-v2/app";
const OUT_FILE = "docs/ux/UX-01-route-matrix.json";

function listPages(root, prefix = "") {
  const out = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "api") continue;
      const isGroup = entry.name.startsWith("(") && entry.name.endsWith(")");
      const seg = isGroup ? "" : "/" + entry.name;
      out.push(...listPages(full, prefix + seg));
    } else if (entry.name === "page.tsx") {
      out.push(prefix || "/");
    }
  }
  return out;
}

const roleOf = (p) => {
  if (p.startsWith("/parent")) return "parent";
  if (p.startsWith("/learner")) return "learner";
  if (p.startsWith("/teacher")) return "teacher";
  if (p.startsWith("/admin/school")) return "school_admin";
  if (p.startsWith("/admin/district")) return "district_admin";
  if (p.startsWith("/admin/platform")) return "platform_admin";
  if (p === "/settings/accessibility") return "shared";
  return "public";
};

const CONSENT_BY_PATH = {
  "/parent/learners/[learnerId]/assessment": ["child_data_collection"],
  "/parent/learners/[learnerId]/assessment/review": ["child_data_collection"],
  "/parent/learners/[learnerId]/iep": ["iep_document_storage"],
  "/parent/learners/[learnerId]/iep/review": ["iep_document_storage"],
  "/parent/learners/[learnerId]/brain-profile": ["child_data_collection", "ai_personalization"],
  "/parent/learners/[learnerId]/baseline": ["child_data_collection", "ai_personalization"],
  "/parent/learners/[learnerId]/lessons": ["child_data_collection"],
  "/parent/learners/[learnerId]/homework": ["child_data_collection"],
  "/learner/home": ["child_data_collection", "ai_personalization"],
  "/learner/baseline/[baselineId]": ["child_data_collection", "ai_personalization"],
  "/learner/lesson-runs/[lessonRunId]": ["child_data_collection", "ai_personalization"],
  "/learner/homework/[sessionId]": ["child_data_collection", "ai_personalization"],
  "/learner/missions": ["child_data_collection", "ai_personalization"],
  "/learner/subjects/[subjectId]": ["child_data_collection"],
  "/learner/quests/[worldId]/chapters/[chapterId]": ["child_data_collection", "ai_personalization"],
  "/teacher/learners/[learnerId]": ["teacher_access"],
};

const purposeOf = (p, role) => {
  if (p === "/") return "Public landing + role-card switcher for the demo.";
  if (p === "/login") return "Mock role picker (real auth lands in identity-svc — see UX-00 DD-15).";
  if (p === "/signup") return "Parent signup — currently disabled UI shell; must be replaced with real auth.";
  if (p.endsWith("/home")) return `${role[0].toUpperCase() + role.slice(1)} home: surfaces the next action${role === "learner" ? " (Today's Mission)" : ""}.`;
  if (p.endsWith("/select") && role === "learner") return "Choose which learner a parent is helping (skipped when only one).";
  if (p.includes("/baseline")) return "Discovery Adventure baseline — adaptive, never displayed as a score.";
  if (p.includes("/lesson-runs/")) return "Full-screen lesson player (Stage) — one beat at a time.";
  if (p.includes("/homework/")) return "Homework Helper chat — tutor-mediated, parent-visible.";
  if (p.includes("/iep")) return "IEP / accommodation document handling — upload + extracted-accommodations review.";
  if (p.includes("/brain-profile")) return "Plain-language brain profile for parent review.";
  if (p.includes("/consent")) return "Per-type consent management with version + accept/revoke history.";
  if (p.includes("/privacy")) return "Parent data-rights surfaces (export, delete, DSAR).";
  if (p.includes("/notifications")) return "Per-channel notification preferences + recent items.";
  if (p.includes("/settings/accessibility")) return "Accessibility preferences (text size, motion, audio).";
  if (p.includes("/settings")) return "Account, billing, and per-role settings.";
  if (p.includes("/assignments/new")) return "Teacher creates a new assignment.";
  if (p.includes("/assignments")) return "Teacher assignment tracking.";
  if (p.includes("/classes/[")) return "Class detail — roster + needs-attention rail.";
  if (p.includes("/classes")) return "Class list with size + last-active.";
  if (p.includes("/insights")) return "Cohort-level mastery + intervention insights.";
  if (p.includes("/learners/new")) return "Add a learner (collects age-gate + initial consents).";
  if (p.includes("/learners/[")) return "Learner detail view — role-scoped subset of the profile.";
  if (p.includes("/learners")) return "Learner list scoped to this role.";
  if (p.includes("/rostering")) return "SIS rostering status + import.";
  if (p.includes("/audit-logs")) return "Tenant-scoped audit log explorer.";
  if (p.includes("/ai-generation")) return "AI generation monitoring.";
  if (p.includes("/ai-costs")) return "Per-tenant LLM cost rollup.";
  if (p.includes("/safety/")) return "Safety review queue / policies / red-team artifacts.";
  if (p.includes("/security/")) return "Security posture — controls, incidents, risks, vendors, vulns.";
  if (p.includes("/compliance/")) return "Compliance artifacts — DSAR / retention / disclosures / data inventory.";
  if (p.includes("/curriculum/")) return "Curriculum management.";
  if (p.includes("/system-health")) return "System health overview.";
  if (p.includes("/tenants")) return "Tenant management.";
  if (p.includes("/users")) return "Cross-tenant user search + actions.";
  if (p.includes("/migration")) return "Data migration ops.";
  if (p.includes("/billing")) return "Billing for this role / tenant scope.";
  if (p.includes("/reports")) return "Reporting scoped to this role.";
  if (p.includes("/staff")) return "School staff roster + roles.";
  if (p.includes("/schedule")) return "Family / class schedule view.";
  if (p.includes("/progress")) return "Progress rollup (mastery, time, streak).";
  if (p.includes("/summary")) return "Plain-language per-learner summary for parents.";
  if (p.includes("/missions")) return "Today's Mission + upcoming.";
  if (p.includes("/quests")) return "Quest worlds and chapters — gated on real learning.";
  if (p.includes("/library")) return "Browsable learning library.";
  if (p.includes("/rewards")) return "Avatar shop, coins, badges — never used to shame.";
  if (p.includes("/audio")) return "Audio settings / pronunciation library.";
  if (p.includes("/data")) return "Tenant data inspector.";
  if (p.includes("/support")) return "Support ticket queue.";
  if (p.includes("/subjects")) return "Subject browsing / detail.";
  return "Role-scoped surface.";
};

const ctaOf = (p, role) => {
  if (p === "/") return "Continue as <role> / Sign in";
  if (p === "/login") return "Sign in";
  if (p === "/signup") return "Create account (currently disabled)";
  if (p.includes("/lesson-runs/")) return "Submit beat response";
  if (p.includes("/baseline/")) return "Continue";
  if (p.includes("/homework/[")) return "Send message";
  if (p.includes("/iep") && !p.endsWith("/review")) return "Upload IEP";
  if (p.includes("/iep/review")) return "Confirm extracted accommodations";
  if (p.includes("/learners/new")) return "Add learner";
  if (p.includes("/assignments/new")) return "Create assignment";
  if (p.includes("/consent")) return "Accept / Revoke";
  if (p.endsWith("/home")) {
    if (role === "learner") return "Start today's mission";
    if (role === "parent") return "Open next action";
    if (role === "teacher") return "Open class needing attention";
    return "Open priority item";
  }
  if (p.includes("/rostering/import")) return "Import roster";
  if (p.includes("/import")) return "Import";
  return "Open detail";
};

const deviceOf = (_p, role) => (role.endsWith("_admin") ? ["web"] : ["web", "tablet", "mobile"]);

const permissionOf = (_p, role) => ({
  public: "none",
  shared: "any signed-in",
  learner: "learner OR (parent + active learner cookie)",
  parent: "parent + parentUserId scope on learner reads",
  teacher: "teacher + class-roster membership for learner reads",
  school_admin: "school_admin + school tenant scope",
  district_admin: "district_admin + district tenant scope",
  platform_admin: "platform_admin",
}[role] ?? "role-gated");

const MVP_ANCHORS = new Set([
  "/", "/login", "/signup",
  "/parent/home", "/parent/learners", "/parent/learners/new",
  "/parent/learners/[learnerId]", "/parent/learners/[learnerId]/assessment",
  "/parent/learners/[learnerId]/iep", "/parent/learners/[learnerId]/baseline",
  "/parent/learners/[learnerId]/brain-profile", "/parent/learners/[learnerId]/progress",
  "/parent/learners/[learnerId]/lessons",
  "/learner/select", "/learner/home", "/learner/baseline", "/learner/baseline/[baselineId]",
  "/learner/lesson-runs/[lessonRunId]",
  "/teacher/home", "/teacher/classes", "/teacher/classes/[classId]", "/teacher/learners/[learnerId]",
  "/admin/platform", "/settings/accessibility",
]);

const priorityOf = (p, role) => {
  if (MVP_ANCHORS.has(p)) return "MVP";
  if (
    role === "district_admin" ||
    p.startsWith("/admin/platform/security") ||
    p.startsWith("/admin/platform/compliance") ||
    p.startsWith("/admin/platform/tenants") ||
    p.startsWith("/admin/platform/migration")
  ) return "enterprise";
  return "school-ready";
};

const mobileBehaviorOf = (role) =>
  role === "learner" ? "Learner Mode tab; full-screen for lesson/baseline/homework"
  : role === "parent" ? "Parent Mode tab content; stacks vertically"
  : role === "teacher" ? "Teacher Mode tab content"
  : role.endsWith("_admin") ? "surfaces a subset under Admin-Lite Mode (alerts / failures / rostering / support only)"
  : "shared across all modes";

const MOBILE_SCREENS = [
  { key: "/welcome", mode: "pre-auth", name: "Welcome", priority: "MVP" },
  { key: "/(auth)/login", mode: "auth", name: "Login", priority: "MVP" },
  { key: "/(auth)/signup", mode: "auth", name: "Signup", priority: "MVP" },
  { key: "/(auth)/pin", mode: "auth", name: "PIN unlock (learner)", priority: "MVP" },
  { key: "/(auth)/verify-mfa", mode: "auth", name: "Verify MFA", priority: "MVP" },
  { key: "/(auth)/forgot-password", mode: "auth", name: "Forgot password", priority: "MVP" },
  { key: "/(auth)/reset-password", mode: "auth", name: "Reset password", priority: "MVP" },
  { key: "/(auth)/change-password", mode: "auth", name: "Change password", priority: "school-ready" },
  { key: "/role-chooser", mode: "auth", name: "Role chooser (first time)", priority: "MVP" },
  { key: "/role-switcher", mode: "shared", name: "Role switcher drawer", priority: "MVP" },
  { key: "parent/home", mode: "parent", name: "Parent home", priority: "MVP" },
  { key: "parent/learners", mode: "parent", name: "Parent learners", priority: "MVP" },
  { key: "parent/progress", mode: "parent", name: "Parent progress", priority: "school-ready" },
  { key: "parent/notifications", mode: "parent", name: "Parent notifications", priority: "school-ready" },
  { key: "parent/settings", mode: "parent", name: "Parent settings", priority: "MVP" },
  { key: "learner/today", mode: "learner", name: "Today (mission)", priority: "MVP" },
  { key: "learner/lesson", mode: "learner", name: "Lesson player", priority: "MVP" },
  { key: "learner/subjects", mode: "learner", name: "Subjects", priority: "school-ready" },
  { key: "learner/quests", mode: "learner", name: "Quests", priority: "school-ready" },
  { key: "learner/homework", mode: "learner", name: "Homework helper", priority: "school-ready" },
  { key: "learner/progress", mode: "learner", name: "Progress", priority: "school-ready" },
  { key: "teacher/home", mode: "teacher", name: "Teacher home", priority: "MVP" },
  { key: "teacher/classes", mode: "teacher", name: "Classes", priority: "MVP" },
  { key: "teacher/learners", mode: "teacher", name: "Learners", priority: "school-ready" },
  { key: "teacher/assignments", mode: "teacher", name: "Assignments", priority: "school-ready" },
  { key: "teacher/notifications", mode: "teacher", name: "Notifications", priority: "school-ready" },
  { key: "admin-lite/alerts", mode: "admin-lite", name: "Alerts", priority: "enterprise" },
  { key: "admin-lite/ai-failures", mode: "admin-lite", name: "AI failures", priority: "enterprise" },
  { key: "admin-lite/rostering-status", mode: "admin-lite", name: "Rostering status", priority: "enterprise" },
  { key: "admin-lite/support", mode: "admin-lite", name: "Support", priority: "enterprise" },
  { key: "shared/settings/account", mode: "shared", name: "Account settings", priority: "MVP" },
  { key: "shared/settings/accessibility", mode: "shared", name: "Accessibility", priority: "MVP" },
  { key: "shared/settings/language", mode: "shared", name: "Language", priority: "school-ready" },
  { key: "shared/settings/notifications", mode: "shared", name: "Notifications prefs", priority: "school-ready" },
  { key: "shared/notifications", mode: "shared", name: "Notification center", priority: "school-ready" },
];

const PLANNED_ROUTES = [
  "/verify-email", "/forgot-password", "/reset-password", "/account-recovery",
  "/help", "/help/[topic]",
  "/parent/inbox", "/parent/learners/[learnerId]/timeline",
  "/learner/inbox",
  "/teacher/learners/[learnerId]/iep-summary",
  "/admin/platform/system-health/incidents",
  "/admin/school/notifications", "/admin/district/notifications", "/admin/platform/notifications",
];

function main() {
  const webRoutes = listPages(APP_ROOT, "").sort();
  const web = webRoutes.map((p) => {
    const role = roleOf(p);
    return {
      path: p,
      name: p === "/" ? "Landing" : p.split("/").filter(Boolean).map((s) => s.replace(/\[|\]/g, "")).join(" / "),
      role,
      device: deviceOf(p, role),
      purpose: purposeOf(p, role),
      primaryCta: ctaOf(p, role),
      requiredData: "see BFF dependency",
      bff: "/api/bff" + p.replace(/\[([^\]]+)\]/g, ":$1"),
      loading: "skeleton",
      empty: "role-appropriate copy + primary CTA",
      error: "inline banner + retry-panel",
      retry: "manual",
      permission: permissionOf(p, role),
      consentDependency: CONSENT_BY_PATH[p] ?? [],
      accessibilityNotes: "inherits SkipLinks + focus-visible from app root; role-specific notes in UX-00 §6",
      mobileBehavior: mobileBehaviorOf(role),
      eng: "requirePageRole on page; per-BFF requireSession + ownership/tenant check (see UX-01 §5)",
      priority: priorityOf(p, role),
      implementationStatus: (p === "/signup" || p === "/login") ? "demo-only — replace per UX-00 DD-15" : "implemented",
    };
  });

  const planned = PLANNED_ROUTES.map((p) => ({
    path: p,
    role: roleOf(p),
    priority: "school-ready",
    implementationStatus: "planned — see UX-00 §3",
  }));

  const output = {
    meta: {
      generatedAt: new Date().toISOString().slice(0, 10),
      webRouteCount: web.length,
      mobileScreenCount: MOBILE_SCREENS.length,
      plannedRouteCount: planned.length,
      sourceOfTruth: "apps/web-v2/app/**/page.tsx (filesystem walk) + UX-01 §2 (mobile)",
      notes: [
        "webRoutes enumerated by filesystem walk; matches the count cited in UX-00 §1 and UX-01 §1.",
        "mobile entries are TARGET screens for the unified app (UX-01 §7); current Expo tree uses separate role groups — see UX-00 §11.",
        "consentDependency uses CONSENT_TYPES from lib/db/types.ts.",
        "Sample entries with fully expanded states/CTAs/copy live in UX-01 §4.1.",
      ],
    },
    web,
    mobile: MOBILE_SCREENS,
    planned,
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2) + "\n");
  console.log(`wrote ${OUT_FILE}: ${web.length} web + ${MOBILE_SCREENS.length} mobile + ${planned.length} planned rows`);
}

main();
