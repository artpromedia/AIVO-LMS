"use client";
import React, { createContext, useContext, useMemo } from "react";
import type { FunctioningLevel, FlProfile } from "../tokens/fl-profiles";
import { FL_PROFILES } from "../tokens/fl-profiles";
import type { MotionBudget } from "../tokens/motion";
import { MOTION_BUDGETS } from "../tokens/motion";

interface FlVariantContextValue {
  level: FunctioningLevel;
  profile: FlProfile;
  motion: MotionBudget;
  isLow: boolean;
  isPreSymbolic: boolean;
  isNonVerbal: boolean;
}

const FlVariantContext = createContext<FlVariantContextValue | null>(null);

export interface FlVariantProviderProps {
  level: FunctioningLevel;
  children: React.ReactNode;
}

export function FlVariantProvider({ level, children }: FlVariantProviderProps) {
  const value = useMemo(() => {
    const profile = FL_PROFILES[level];
    const motion = MOTION_BUDGETS[level];
    return {
      level,
      profile,
      motion,
      isLow: level === "LOW_VERBAL" || level === "NON_VERBAL" || level === "PRE_SYMBOLIC",
      isPreSymbolic: level === "PRE_SYMBOLIC",
      isNonVerbal: level === "NON_VERBAL",
    };
  }, [level]);

  return <FlVariantContext.Provider value={value}>{children}</FlVariantContext.Provider>;
}

export function useFlVariant() {
  const ctx = useContext(FlVariantContext);
  if (!ctx) throw new Error("useFlVariant must be used within FlVariantProvider");
  return ctx;
}
