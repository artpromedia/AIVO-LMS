"use client";
import { forwardRef, type SVGProps } from "react";
import {
  // AI
  BrainCircuit,
  Sparkles,
  Wand2,
  // Curriculum
  BookOpen,
  GraduationCap,
  Library,
  // Mastery
  Trophy,
  Target,
  TrendingUp,
  // IEP / accommodations
  FileText,
  ClipboardList,
  HeartHandshake,
  // Safety / moderation
  ShieldCheck,
  ShieldAlert,
  Flag,
  // Billing
  CreditCard,
  Receipt,
  Wallet,
  // Rostering
  Users,
  School,
  Building2,
  // Consent
  ClipboardCheck,
  ScrollText,
  Lock,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import { cn } from "../utils/cn";

/**
 * Icon/AivoIcon — canonical, named icon set for the AIVO calm system.
 *
 * Wraps lucide-react with:
 *  - A thin, calm default stroke width (1.6px) matching the Satoshi
 *    headline weight; consumers can override via `strokeWidth`.
 *  - A constrained semantic name -> visual mapping so feature work in
 *    apps never has to make icon decisions ad-hoc.
 *
 * Add a new domain icon ONLY by adding a new entry to AIVO_ICONS below
 * (do not import lucide directly in apps for these domains).
 */
export const AIVO_ICONS = {
  // AI
  aiBrain: BrainCircuit,
  aiSparkle: Sparkles,
  aiWand: Wand2,
  // Curriculum
  curriculum: BookOpen,
  classroom: GraduationCap,
  library: Library,
  // Mastery
  mastery: Trophy,
  goal: Target,
  growth: TrendingUp,
  // IEP / accommodations
  iep: FileText,
  plan: ClipboardList,
  care: HeartHandshake,
  // Safety / moderation
  safetyOk: ShieldCheck,
  safetyAlert: ShieldAlert,
  safetyFlag: Flag,
  // Billing
  billingCard: CreditCard,
  billingReceipt: Receipt,
  billingWallet: Wallet,
  // Rostering
  rosterStudents: Users,
  rosterSchool: School,
  rosterDistrict: Building2,
  // Consent
  consentCheck: ClipboardCheck,
  consentDoc: ScrollText,
  consentLock: Lock,
} as const satisfies Record<string, LucideIcon>;

export type AivoIconName = keyof typeof AIVO_ICONS;

export type AivoIconProps = Omit<LucideProps, "ref"> & {
  name: AivoIconName;
  /** Visual tone — defaults to currentColor. */
  tone?:
    | "default"
    | "muted"
    | "brand"
    | "mastery"
    | "risk"
    | "safety"
    | "billing"
    | "consent"
    | "info";
};

const TONE_CLASS: Record<NonNullable<AivoIconProps["tone"]>, string> = {
  default: "text-iw-text-strong",
  muted: "text-iw-text-muted",
  brand: "text-iw-purple-500",
  mastery: "text-iw-mastery-proficient-strong",
  risk: "text-iw-risk-elevated-strong",
  safety: "text-iw-safety-safe-strong",
  billing: "text-iw-billing-paid-strong",
  consent: "text-iw-consent-granted-strong",
  info: "text-iw-info",
};

export const AivoIcon = forwardRef<SVGSVGElement, AivoIconProps>(function AivoIcon(
  { name, tone = "default", strokeWidth = 1.6, className, ...rest },
  ref,
) {
  const Icon = AIVO_ICONS[name];
  return (
    <Icon
      ref={ref as unknown as SVGProps<SVGSVGElement>["ref"]}
      strokeWidth={strokeWidth}
      className={cn(TONE_CLASS[tone], className)}
      {...rest}
    />
  );
});

AivoIcon.displayName = "Icon/AivoIcon";
