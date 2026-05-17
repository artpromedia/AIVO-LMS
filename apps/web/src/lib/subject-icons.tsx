import type { LucideIcon } from "lucide-react";
import {
  Calculator,
  BookOpen,
  FlaskConical,
  Landmark,
  Code2,
  Users2,
  Heart,
  MessageCircle,
  Puzzle,
  Home,
  Target,
  Palette,
  Eye,
  GraduationCap,
} from "lucide-react";

export const SUBJECT_ICON: Record<string, LucideIcon> = {
  math: Calculator,
  ela: BookOpen,
  reading: BookOpen,
  english: BookOpen,
  science: FlaskConical,
  history: Landmark,
  social_studies: Landmark,
  coding: Code2,
  computer_science: Code2,
  social: Users2,
  sel: Heart,
  speech: MessageCircle,
  communication: MessageCircle,
  executive_function: Puzzle,
  daily_living: Home,
  cause_effect: Target,
  sensory_engagement: Palette,
  social_awareness: Eye,
  other: GraduationCap,
};

export function subjectIcon(key?: string): LucideIcon {
  if (!key) return GraduationCap;
  return SUBJECT_ICON[key.toLowerCase()] || GraduationCap;
}

export type SubjectViColor = "primary" | "math" | "reading" | "science" | "sel";

export const SUBJECT_VI_COLOR: Record<string, SubjectViColor> = {
  math: "math",
  ela: "reading",
  reading: "reading",
  english: "reading",
  science: "science",
  history: "sel",
  social_studies: "sel",
  coding: "primary",
  computer_science: "primary",
  social: "math",
  sel: "sel",
  speech: "primary",
  communication: "reading",
  executive_function: "reading",
  daily_living: "science",
  cause_effect: "science",
  sensory_engagement: "primary",
  social_awareness: "math",
  other: "primary",
};

export function subjectViColor(key?: string): SubjectViColor {
  if (!key) return "primary";
  return SUBJECT_VI_COLOR[key.toLowerCase()] || "primary";
}

const VI_BAR_CLASS: Record<SubjectViColor, string> = {
  primary: "bg-[hsl(var(--visual-primary))]",
  math: "bg-[hsl(var(--visual-math))]",
  reading: "bg-[hsl(var(--visual-reading))]",
  science: "bg-[hsl(var(--visual-science))]",
  sel: "bg-[hsl(var(--visual-sel))]",
};

const VI_WELL_CLASS: Record<SubjectViColor, string> = {
  primary: "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]",
  math: "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]",
  reading: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]",
  science: "bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))]",
  sel: "bg-[hsl(var(--visual-sel)/0.16)] text-[hsl(var(--visual-sel))]",
};

export function subjectBarClass(key?: string): string {
  return VI_BAR_CLASS[subjectViColor(key)];
}

export function subjectWellClass(key?: string): string {
  return VI_WELL_CLASS[subjectViColor(key)];
}
