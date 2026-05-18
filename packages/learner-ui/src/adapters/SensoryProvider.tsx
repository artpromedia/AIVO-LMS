"use client";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { FunctioningLevel } from "../tokens/fl-profiles";
import type { SensoryProfile, SensoryVars } from "../tokens/sensory-vars";
import {
  computeSensoryVars,
  writeSensoryVarsToRoot,
  clearSensoryVarsFromRoot,
} from "../tokens/sensory-vars";

interface SensoryContextValue {
  vars: SensoryVars;
  sensoryProfile: SensoryProfile | null;
  functioningLevel: FunctioningLevel;
}

const SensoryContext = createContext<SensoryContextValue | null>(null);

export interface SensoryProviderProps {
  functioningLevel: FunctioningLevel;
  sensoryProfile?: SensoryProfile;
  children: React.ReactNode;
}

export function SensoryProvider({
  functioningLevel,
  sensoryProfile,
  children,
}: SensoryProviderProps) {
  const vars = useMemo(
    () => computeSensoryVars(functioningLevel, sensoryProfile),
    [functioningLevel, sensoryProfile],
  );

  useEffect(() => {
    writeSensoryVarsToRoot(vars);
    return () => clearSensoryVarsFromRoot();
  }, [vars]);

  const value = useMemo(
    () => ({ vars, sensoryProfile: sensoryProfile || null, functioningLevel }),
    [vars, sensoryProfile, functioningLevel],
  );

  return <SensoryContext.Provider value={value}>{children}</SensoryContext.Provider>;
}

export function useSensoryContext() {
  const ctx = useContext(SensoryContext);
  if (!ctx) throw new Error("useSensoryContext must be used within SensoryProvider");
  return ctx;
}
