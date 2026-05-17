import type { FunctioningLevel } from "./fl-profiles";

export interface MotionBudget {
  maxConcurrentAnimations: number;
  defaultDurationMs: number;
  transitionDurationMs: number;
  previewDurationMs: number;
  celebrationDurationMs: number;
  particleCount: number;
  enableParticles: boolean;
  enableBounce: boolean;
  enablePulse: boolean;
}

export const MOTION_BUDGETS: Record<FunctioningLevel, MotionBudget> = {
  STANDARD: {
    maxConcurrentAnimations: 8,
    defaultDurationMs: 300,
    transitionDurationMs: 300,
    previewDurationMs: 600,
    celebrationDurationMs: 2500,
    particleCount: 10,
    enableParticles: true,
    enableBounce: true,
    enablePulse: true,
  },
  SUPPORTED: {
    maxConcurrentAnimations: 4,
    defaultDurationMs: 500,
    transitionDurationMs: 400,
    previewDurationMs: 800,
    celebrationDurationMs: 2000,
    particleCount: 3,
    enableParticles: true,
    enableBounce: false,
    enablePulse: true,
  },
  LOW_VERBAL: {
    maxConcurrentAnimations: 2,
    defaultDurationMs: 700,
    transitionDurationMs: 500,
    previewDurationMs: 1000,
    celebrationDurationMs: 1500,
    particleCount: 0,
    enableParticles: false,
    enableBounce: false,
    enablePulse: false,
  },
  NON_VERBAL: {
    maxConcurrentAnimations: 1,
    defaultDurationMs: 0,
    transitionDurationMs: 200,
    previewDurationMs: 1200,
    celebrationDurationMs: 1000,
    particleCount: 0,
    enableParticles: false,
    enableBounce: false,
    enablePulse: false,
  },
  PRE_SYMBOLIC: {
    maxConcurrentAnimations: 0,
    defaultDurationMs: 0,
    transitionDurationMs: 0,
    previewDurationMs: 0,
    celebrationDurationMs: 0,
    particleCount: 0,
    enableParticles: false,
    enableBounce: false,
    enablePulse: false,
  },
};
