import {
  Home,
  Users,
  Calendar,
  FileText,
  Settings,
  Sparkles,
  Trophy,
  BookOpen,
  ClipboardList,
  BarChart3,
  Building2,
  Network,
  Shield,
  Activity,
  Database,
  ShieldAlert,
  Cpu,
  ScrollText,
  CreditCard,
  LifeBuoy,
  DollarSign,
  GraduationCap,
  ShieldCheck,
  UploadCloud,
  Bell,
  Wind,
} from "lucide-react";
import { Permission } from "@aivo/security";
import type { RoleNavItem } from "@/components/layout/role-nav";
import { LearnerUnreadNotificationsBadge } from "@/components/layout/learner-unread-notifications-badge";
import type { SessionProfile } from "@/lib/auth/types";
import { sessionHasPermission } from "@/lib/auth/permissions";

export const PARENT_NAV: RoleNavItem[] = [
  { href: "/parent/home", label: "Home", icon: <Home className="h-4 w-4" /> },
  { href: "/parent/learners", label: "Learners", icon: <Users className="h-4 w-4" /> },
  { href: "/parent/schedule", label: "Schedule", icon: <Calendar className="h-4 w-4" /> },
  { href: "/parent/reports", label: "Reports", icon: <FileText className="h-4 w-4" /> },
  { href: "/parent/privacy", label: "Privacy", icon: <ShieldCheck className="h-4 w-4" /> },
  { href: "/notifications", label: "Notifications", icon: <Bell className="h-4 w-4" /> },
  { href: "/parent/settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
];

export const LEARNER_NAV: RoleNavItem[] = [
  { href: "/learner/home", label: "Today", icon: <Home className="h-4 w-4" /> },
  { href: "/learner/progress", label: "Progress", icon: <BarChart3 className="h-4 w-4" /> },
  { href: "/learner/missions", label: "Missions", icon: <Sparkles className="h-4 w-4" /> },
  { href: "/learner/library", label: "Library", icon: <BookOpen className="h-4 w-4" /> },
  { href: "/learner/calm", label: "Calm", icon: <Wind className="h-4 w-4" /> },
  { href: "/learner/rewards", label: "Rewards", icon: <Trophy className="h-4 w-4" /> },
  {
    href: "/notifications",
    label: "Notifications",
    icon: <Bell className="h-4 w-4" />,
    badgeSlot: <LearnerUnreadNotificationsBadge />,
  },
  { href: "/learner/settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
];

export const TEACHER_NAV: RoleNavItem[] = [
  { href: "/teacher/home", label: "Home", icon: <Home className="h-4 w-4" /> },
  { href: "/teacher/classes", label: "Classes", icon: <Users className="h-4 w-4" /> },
  { href: "/teacher/rostering", label: "Rostering", icon: <Network className="h-4 w-4" /> },
  { href: "/teacher/learners", label: "Learners", icon: <Users className="h-4 w-4" /> },
  {
    href: "/teacher/assignments",
    label: "Assignments",
    icon: <ClipboardList className="h-4 w-4" />,
  },
  { href: "/teacher/lesson-plans", label: "Lesson Plans", icon: <Sparkles className="h-4 w-4" /> },
  { href: "/teacher/reports", label: "Reports", icon: <FileText className="h-4 w-4" /> },
  { href: "/teacher/insights", label: "Insights", icon: <BarChart3 className="h-4 w-4" /> },
  { href: "/teacher/settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
];

export const SCHOOL_NAV: RoleNavItem[] = [
  { href: "/admin/school", label: "Overview", icon: <Building2 className="h-4 w-4" /> },
  { href: "/admin/school/staff", label: "Staff", icon: <Users className="h-4 w-4" /> },
  { href: "/admin/school/ai", label: "AI", icon: <Cpu className="h-4 w-4" /> },
  { href: "/admin/school/status", label: "Status", icon: <Activity className="h-4 w-4" /> },
  {
    href: "/admin/school/learners",
    label: "Learners",
    icon: <GraduationCap className="h-4 w-4" />,
  },
  { href: "/admin/school/classes", label: "Classes", icon: <ClipboardList className="h-4 w-4" /> },
  {
    href: "/admin/school/classrooms",
    label: "Classrooms",
    icon: <ClipboardList className="h-4 w-4" />,
  },
  {
    href: "/admin/school/rostering",
    label: "Rostering",
    icon: <UploadCloud className="h-4 w-4" />,
  },
  { href: "/admin/school/reports", label: "Reports", icon: <FileText className="h-4 w-4" /> },
  { href: "/admin/school/billing", label: "Billing", icon: <CreditCard className="h-4 w-4" /> },
  { href: "/admin/school/compliance", label: "Compliance", icon: <Shield className="h-4 w-4" /> },
  {
    href: "/admin/school/notifications",
    label: "Notifications",
    icon: <Bell className="h-4 w-4" />,
  },
  { href: "/admin/school/audit", label: "Audit", icon: <ScrollText className="h-4 w-4" /> },
  { href: "/admin/school/settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
];

export const DISTRICT_NAV: RoleNavItem[] = [
  { href: "/admin/district", label: "Overview", icon: <Network className="h-4 w-4" /> },
  { href: "/admin/district/schools", label: "Schools", icon: <Building2 className="h-4 w-4" /> },
  { href: "/admin/district/ai", label: "AI controls", icon: <Cpu className="h-4 w-4" /> },
  { href: "/admin/district/status", label: "Status", icon: <Activity className="h-4 w-4" /> },
  {
    href: "/admin/district/impersonation",
    label: "View-As log",
    icon: <Shield className="h-4 w-4" />,
  },
  { href: "/admin/district/staff", label: "Staff", icon: <Users className="h-4 w-4" /> },
  { href: "/admin/district/iep", label: "IEPs", icon: <ClipboardList className="h-4 w-4" /> },
  { href: "/admin/district/reports", label: "Reports", icon: <FileText className="h-4 w-4" /> },
  { href: "/admin/district/billing", label: "Billing", icon: <CreditCard className="h-4 w-4" /> },
  { href: "/admin/district/compliance", label: "Compliance", icon: <Shield className="h-4 w-4" /> },
  {
    href: "/admin/district/identity",
    label: "Identity",
    icon: <ShieldCheck className="h-4 w-4" />,
  },
  { href: "/admin/district/sis", label: "SIS Sync", icon: <UploadCloud className="h-4 w-4" /> },
  { href: "/admin/district/audit", label: "Audit", icon: <ScrollText className="h-4 w-4" /> },
  { href: "/admin/district/settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
];

/** Sub-nav appended when on /admin/district/settings/* sub-pages. */
export const DISTRICT_SETTINGS_NAV: RoleNavItem[] = [
  { href: "/admin/district/settings", label: "Overview", icon: <Settings className="h-4 w-4" /> },
  {
    href: "/admin/district/settings/branding",
    label: "Branding",
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    href: "/admin/district/settings/sso",
    label: "SSO & SCIM",
    icon: <ShieldCheck className="h-4 w-4" />,
  },
  { href: "/admin/district/settings/admins", label: "Admins", icon: <Users className="h-4 w-4" /> },
];

export const PLATFORM_NAV: RoleNavItem[] = [
  { href: "/admin/platform", label: "System health", icon: <Activity className="h-4 w-4" /> },
  {
    href: "/admin/platform/status",
    label: "Status & SLOs",
    icon: <Activity className="h-4 w-4" />,
  },
  { href: "/admin/platform/ai", label: "Responsible AI", icon: <Cpu className="h-4 w-4" /> },
  { href: "/admin/platform/reports", label: "Reports", icon: <FileText className="h-4 w-4" /> },
  {
    href: "/admin/platform/impersonation",
    label: "View-As log",
    icon: <Shield className="h-4 w-4" />,
  },
  { href: "/admin/platform/tenants", label: "Tenants", icon: <Users className="h-4 w-4" /> },
  { href: "/admin/platform/identity", label: "Identity", icon: <Shield className="h-4 w-4" /> },
  { href: "/admin/platform/sis", label: "SIS Sync", icon: <UploadCloud className="h-4 w-4" /> },
  { href: "/admin/platform/audit", label: "Audit", icon: <ScrollText className="h-4 w-4" /> },
  { href: "/admin/platform/users", label: "Users", icon: <Users className="h-4 w-4" /> },
  { href: "/admin/platform/staff", label: "Staff", icon: <Users className="h-4 w-4" /> },
  {
    href: "/admin/platform/learners",
    label: "Learners",
    icon: <GraduationCap className="h-4 w-4" />,
  },
  { href: "/admin/platform/jobs", label: "Jobs", icon: <Activity className="h-4 w-4" /> },
  {
    href: "/admin/platform/ai-generation",
    label: "AI generation",
    icon: <Cpu className="h-4 w-4" />,
  },
  {
    href: "/admin/platform/baseline-items",
    label: "Baseline items",
    icon: <GraduationCap className="h-4 w-4" />,
  },
  {
    href: "/admin/platform/audit-logs",
    label: "Audit logs",
    icon: <ScrollText className="h-4 w-4" />,
  },
  { href: "/admin/platform/billing", label: "Billing", icon: <DollarSign className="h-4 w-4" /> },
  {
    href: "/admin/platform/billing/coupons",
    label: "Coupons",
    icon: <DollarSign className="h-4 w-4" />,
  },
  {
    href: "/admin/platform/billing/daily-batch",
    label: "Daily batch",
    icon: <Activity className="h-4 w-4" />,
  },
  {
    href: "/admin/platform/ai/moderation",
    label: "AI moderation",
    icon: <ShieldAlert className="h-4 w-4" />,
  },
  {
    href: "/admin/platform/ai/playground",
    label: "AI playground",
    icon: <Cpu className="h-4 w-4" />,
  },
  { href: "/admin/platform/ai-costs", label: "AI costs", icon: <DollarSign className="h-4 w-4" /> },
  { href: "/admin/platform/migration", label: "Migration", icon: <Database className="h-4 w-4" /> },
  { href: "/admin/platform/support", label: "Support", icon: <LifeBuoy className="h-4 w-4" /> },
  { href: "/admin/platform/data", label: "Data", icon: <Database className="h-4 w-4" /> },
  {
    href: "/admin/platform/security",
    label: "Security",
    icon: <ShieldAlert className="h-4 w-4" />,
  },
  {
    href: "/admin/platform/compliance",
    label: "Compliance",
    icon: <ShieldCheck className="h-4 w-4" />,
  },
  {
    href: "/admin/platform/curriculum",
    label: "Curriculum",
    icon: <BookOpen className="h-4 w-4" />,
  },
  { href: "/admin/platform/safety", label: "Safety", icon: <ShieldAlert className="h-4 w-4" /> },
  { href: "/admin/platform/audio", label: "Audio", icon: <Sparkles className="h-4 w-4" /> },
  { href: "/admin/platform/settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
];

const PLATFORM_NAV_PERMISSIONS: Record<string, Permission> = {
  "/admin/platform": Permission.PlatformRead,
  "/admin/platform/status": Permission.PlatformRead,
  "/admin/platform/ai": Permission.AiRead,
  "/admin/platform/reports": Permission.ReportsRead,
  "/admin/platform/impersonation": Permission.UserRead,
  "/admin/platform/tenants": Permission.TenantRead,
  "/admin/platform/identity": Permission.UserRead,
  "/admin/platform/sis": Permission.TenantRead,
  "/admin/platform/audit": Permission.AuditRead,
  "/admin/platform/users": Permission.UserRead,
  "/admin/platform/staff": Permission.UserRead,
  "/admin/platform/learners": Permission.LearnerRead,
  "/admin/platform/jobs": Permission.PlatformRead,
  "/admin/platform/ai-generation": Permission.AiRead,
  "/admin/platform/baseline-items": Permission.AiRead,
  "/admin/platform/audit-logs": Permission.AuditRead,
  "/admin/platform/billing": Permission.BillingRead,
  "/admin/platform/billing/coupons": Permission.BillingRead,
  "/admin/platform/billing/daily-batch": Permission.BillingRead,
  "/admin/platform/ai/moderation": Permission.SecurityRead,
  "/admin/platform/ai/playground": Permission.AiRead,
  "/admin/platform/ai-costs": Permission.AiRead,
  "/admin/platform/migration": Permission.PlatformRead,
  "/admin/platform/support": Permission.SupportRead,
  "/admin/platform/data": Permission.PlatformRead,
  "/admin/platform/security": Permission.SecurityRead,
  "/admin/platform/compliance": Permission.SecurityRead,
  "/admin/platform/curriculum": Permission.CurriculumRead,
  "/admin/platform/safety": Permission.SecurityRead,
  "/admin/platform/audio": Permission.PlatformRead,
  "/admin/platform/settings": Permission.PlatformRead,
};

const NON_ADMIN_PLATFORM_NAV: Record<string, readonly string[]> = {
  [Permission.PlatformRead]: ["/admin/platform", "/admin/platform/status"],
  [Permission.ReportsRead]: ["/admin/platform/reports"],
  [Permission.UserRead]: ["/admin/platform/users", "/admin/platform/staff"],
  [Permission.TenantRead]: ["/admin/platform/tenants"],
  [Permission.AuditRead]: ["/admin/platform/audit-logs"],
  [Permission.BillingRead]: ["/admin/platform/billing"],
  [Permission.SecurityRead]: ["/admin/platform/security"],
  [Permission.SupportRead]: ["/admin/platform/support"],
  [Permission.CurriculumRead]: ["/admin/platform/curriculum"],
  [Permission.AiRead]: ["/admin/platform/ai"],
};

export function platformNavForSession(session: SessionProfile): RoleNavItem[] {
  return PLATFORM_NAV.filter((item) => {
    const permission = PLATFORM_NAV_PERMISSIONS[item.href];
    if (!permission || !sessionHasPermission(session, permission)) return false;
    if (session.role === "platform_admin") return true;
    const allowedHrefs = NON_ADMIN_PLATFORM_NAV[permission];
    return !allowedHrefs || allowedHrefs.includes(item.href);
  });
}

/** Sub-nav appended to PARENT_NAV when on the /parent/settings/* family. */
export const PARENT_SETTINGS_NAV: RoleNavItem[] = [
  { href: "/parent/settings", label: "Overview", icon: <Settings className="h-4 w-4" /> },
  { href: "/parent/settings/account", label: "Account", icon: <Users className="h-4 w-4" /> },
  { href: "/parent/settings/billing", label: "Billing", icon: <CreditCard className="h-4 w-4" /> },
];

export const CAREGIVER_NAV: RoleNavItem[] = [
  { href: "/caregiver/home", label: "Home", icon: <Home className="h-4 w-4" /> },
  { href: "/caregiver/learners", label: "Learners", icon: <Users className="h-4 w-4" /> },
  {
    href: "/caregiver/observations",
    label: "Observations",
    icon: <ClipboardList className="h-4 w-4" />,
  },
  { href: "/caregiver/settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
];

export const THERAPIST_NAV: RoleNavItem[] = [
  { href: "/therapist/home", label: "Caseload", icon: <Users className="h-4 w-4" /> },
  { href: "/therapist/reports", label: "Reports", icon: <FileText className="h-4 w-4" /> },
  { href: "/therapist/sessions", label: "Sessions", icon: <Calendar className="h-4 w-4" /> },
  { href: "/therapist/settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
];
