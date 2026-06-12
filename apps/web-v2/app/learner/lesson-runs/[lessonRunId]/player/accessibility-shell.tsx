"use client";

/**
 * Sprint 12 — the player's accessibility + sensory presentation layer.
 *
 * `deriveStagePresentation` computes (in one home) everything the original
 * lesson-player.tsx derived inline: the root utility classes, Sprint 03
 * sensory CSS vars + density, the effective accessibility settings handed
 * to surfaces, and the `data-*` attributes consumed by app/a11y-modes.css +
 * app/fonts-dyslexia.css.
 *
 * `AccessibilityShell` renders the wrapper div carrying those attributes
 * and, when AAC is enabled, mounts the Sprint 7 AAC target provider + scan
 * root around the whole tree (Space = activate, ArrowRight = advance, so a
 * single-switch device can drive the full flow). The aria-live regions stay
 * at their original DOM positions inside the player body — moving them into
 * this wrapper would change announcement semantics.
 */
import type { CSSProperties, ReactNode } from "react";
import { AACTargetProvider, AACScanRoot } from "@aivo/aac-bridge";
import {
  deriveSensoryAdaptations,
  sensoryCSSVars,
  toStageSensoryProfile,
} from "@aivo/stage-runtime";
import type { FunctioningLevel } from "@aivo/stage-ui";
import type { SurfaceTelemetryEvent } from "@aivo/learner-surfaces";
import type { AccessibilityPreferences } from "@/lib/db/types";

/** Root classes shared by the player body AND the standalone break card. */
export function a11yRootClass(accessibility: AccessibilityPreferences): string {
  return [
    accessibility.largeText ? "text-lg leading-relaxed" : "",
    accessibility.highContrast ? "bg-aivo-surface text-black" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export interface StagePresentation {
  rootClass: string;
  stageVars: CSSProperties;
  stageDensity: "minimal" | "reduced" | "standard";
  /** Surfaces consume reducedMotion through their existing settings prop. */
  effectiveAccessibility: AccessibilityPreferences;
  motionOff: boolean;
  transitionClass: string;
  a11yAttrs: {
    "data-typeface": "dyslexia" | undefined;
    "data-keyboard-optimized": "on" | undefined;
    "data-visual-supports": "on" | undefined;
  };
}

export function deriveStagePresentation(
  accessibility: AccessibilityPreferences,
  sensoryModalities: Record<string, string> | null,
  functioningLevel: FunctioningLevel,
): StagePresentation {
  // ----- Accessibility-derived classes + DOM attributes -----
  // Dyslexia font is applied via `data-typeface="dyslexia"` (see below), which
  // resolves to the bundled Atkinson Hyperlegible / OpenDyslexic webfonts plus
  // the spec'd letter-spacing/line-height. The previous `font-mono` mapping was
  // wrong — monospace is not a dyslexia-friendly face.
  const rootClass = a11yRootClass(accessibility);

  // ----- Sensory profile → stage adaptations (Sprint 03) -----
  // The per-learner profile sets the BASE vars; the global sensory mode
  // multiplies on top in CSS (var(--aivo-sensory-motionScale): standard 1,
  // calm 0.5, high-contrast 0) so the calmer of the two always wins and the
  // values stay hydration-safe (no client-only reads).
  const sensoryAdaptations = deriveSensoryAdaptations(
    toStageSensoryProfile(sensoryModalities),
    { functioningLevel },
  );
  const stageVars = sensoryCSSVars(sensoryAdaptations) as CSSProperties;
  const stageDensity =
    sensoryAdaptations.maxOnScreenElements <= 3
      ? "minimal"
      : sensoryAdaptations.maxOnScreenElements <= 4
        ? "reduced"
        : "standard";
  // Surfaces consume reducedMotion through their existing settings prop —
  // a vestibular/proprioceptive-hyper profile quiets them with no API change.
  const effectiveAccessibility =
    sensoryAdaptations.motionReduced && !accessibility.reducedMotion
      ? { ...accessibility, reducedMotion: true }
      : accessibility;
  const motionOff = accessibility.reducedMotion || sensoryAdaptations.motionReduced;
  const transitionClass = motionOff
    ? ""
    : "transition-all duration-[calc(var(--stage-transition-duration,300ms)*var(--aivo-sensory-motionScale,1))]";

  // Data attributes consumed by app/a11y-modes.css + app/fonts-dyslexia.css so
  // the remaining preferences actually render rather than just persisting.
  const a11yAttrs = {
    "data-typeface": accessibility.dyslexiaFriendlyFont ? ("dyslexia" as const) : undefined,
    "data-keyboard-optimized": accessibility.keyboardOptimized ? ("on" as const) : undefined,
    "data-visual-supports": accessibility.visualSupports ? ("on" as const) : undefined,
  };

  return {
    rootClass,
    stageVars,
    stageDensity,
    effectiveAccessibility,
    motionOff,
    transitionClass,
    a11yAttrs,
  };
}

export interface AccessibilityShellProps {
  accessibility: AccessibilityPreferences;
  presentation: StagePresentation;
  /** AAC activations mirror into the surface-telemetry sink. */
  onSurfaceTelemetry: (event: SurfaceTelemetryEvent) => void;
  children: ReactNode;
}

export function AccessibilityShell({
  accessibility,
  presentation,
  onSurfaceTelemetry,
  children,
}: AccessibilityShellProps) {
  const innerTree = (
    <div
      className={`${presentation.rootClass} [filter:saturate(var(--stage-saturation,100%))]`}
      style={presentation.stageVars}
      data-stage-density={presentation.stageDensity}
      {...presentation.a11yAttrs}
    >
      {children}
    </div>
  );

  // Sprint 7 — wrap the entire lesson-player tree in the AAC target
  // provider when the learner has enabled AAC. Surfaces (ChoiceGrid,
  // submit buttons) auto-register via useAACTarget; AACScanRoot listens
  // for Space (activate) and ArrowRight (advance) so a single-switch
  // device mapped to those keys can drive the whole flow.
  if (accessibility.aacEnabled !== true) return innerTree;
  return (
    <AACTargetProvider
      enabled
      inputMethod={accessibility.aacInputMethod}
      scanDelayMs={accessibility.aacScanDelayMs}
      onEvent={(evt) => {
        // Mirror AAC activations into the existing surface-telemetry
        // sink so analytics can correlate them with lesson outcomes.
        onSurfaceTelemetry({
          id: globalThis.crypto?.randomUUID?.() ?? `aac-${evt.targetId}-${Date.now()}`,
          surfaceId: "aac",
          type: "answer_changed",
          occurredAt: new Date().toISOString(),
          payload: { source: "aac", targetId: evt.targetId, method: evt.method },
        } satisfies SurfaceTelemetryEvent);
      }}
    >
      <AACScanRoot>{innerTree}</AACScanRoot>
    </AACTargetProvider>
  );
}
