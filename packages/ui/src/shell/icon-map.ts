/**
 * Bridge from `@aivo/nav` NavIconName strings to the AivoIcon component.
 * Kept separate so the registry stays React-free.
 */
import type { NavIconName } from "@aivo/nav";
import type { AivoIconName } from "../icon/AivoIcon.js";

/**
 * `NavIconName` is intentionally a superset alias matching `AivoIconName`
 * by string. This map exists as an explicit assertion so a typo on
 * either side trips the compiler.
 */
export const NAV_ICON_TO_AIVO_ICON: Record<NavIconName, AivoIconName> = {
  aiBrain: "aiBrain",
  aiSparkle: "aiSparkle",
  aiWand: "aiWand",
  curriculum: "curriculum",
  classroom: "classroom",
  library: "library",
  mastery: "mastery",
  goal: "goal",
  growth: "growth",
  iep: "iep",
  plan: "plan",
  care: "care",
  safetyOk: "safetyOk",
  safetyAlert: "safetyAlert",
  safetyFlag: "safetyFlag",
  billingCard: "billingCard",
  billingReceipt: "billingReceipt",
  billingWallet: "billingWallet",
  rosterStudents: "rosterStudents",
  rosterSchool: "rosterSchool",
  rosterDistrict: "rosterDistrict",
  consentCheck: "consentCheck",
  consentDoc: "consentDoc",
  consentLock: "consentLock",
};
