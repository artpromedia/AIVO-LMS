// Per-role theme tokens.
//
// Drives subtle role-aware accents in chrome (header pill, role
// switcher, surface tinting) without changing the underlying brand
// identity. All values resolve to brand tokens — no role gets its own
// brand color.

import { COLORS, GRADIENTS } from "./tokens.js";

export type RoleThemeKey =
  | "parent"
  | "learner"
  | "teacher"
  | "caregiver"
  | "therapist"
  | "schoolAdmin"
  | "districtAdmin"
  | "platformAdmin";

export interface RoleTheme {
  /** Display label for chrome (sentence case). */
  label: string;
  /** Foreground accent for role pills, icons, focus states. */
  accent: string;
  /** Background tint for the active role chrome surface. */
  accentSoft: string;
  /** Optional gradient for celebratory/role-switch transitions. */
  gradient: string;
}

export const ROLE_THEMES: Record<RoleThemeKey, RoleTheme> = {
  parent: {
    label: "Parent",
    accent: COLORS.primary,
    accentSoft: COLORS.primaryLight,
    gradient: GRADIENTS.brandSoft,
  },
  learner: {
    label: "Learner",
    accent: COLORS.accent,
    accentSoft: "#FFF6DA",
    gradient: GRADIENTS.celebrate,
  },
  teacher: {
    label: "Teacher",
    accent: COLORS.visualReading,
    accentSoft: "#DBEAFE",
    gradient: GRADIENTS.reading,
  },
  caregiver: {
    label: "Caregiver",
    accent: COLORS.visualScience,
    accentSoft: "#DCFCE7",
    gradient: GRADIENTS.science,
  },
  therapist: {
    label: "Therapist",
    accent: COLORS.visualMath,
    accentSoft: "#FCE7F3",
    gradient: GRADIENTS.math,
  },
  schoolAdmin: {
    label: "School Admin",
    accent: COLORS.primaryDark,
    accentSoft: COLORS.primaryLight,
    gradient: GRADIENTS.brand,
  },
  districtAdmin: {
    label: "District Admin",
    accent: "#1E40AF",
    accentSoft: "#DBEAFE",
    gradient: GRADIENTS.reading,
  },
  platformAdmin: {
    label: "Platform Admin",
    accent: COLORS.text,
    accentSoft: COLORS.surfaceMuted,
    gradient: `linear-gradient(135deg, ${COLORS.text} 0%, #0F172A 100%)`,
  },
};

export function getRoleTheme(role: RoleThemeKey): RoleTheme {
  return ROLE_THEMES[role];
}
