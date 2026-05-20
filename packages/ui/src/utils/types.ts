/**
 * Shared component-state vocabulary used by every AIVO UI primitive.
 *
 * Every surface, overlay, and state primitive accepts a `state` prop
 * (or in some cases derives it from its own internal model). The same
 * six states are honoured across the system so behavior, focus rings,
 * loading shimmers, and empty visuals stay consistent.
 */
export type AivoComponentState =
  | "default"
  | "hover"
  | "focus"
  | "disabled"
  | "loading"
  | "error"
  | "empty";

/** Tone slot — drives colour family on chips, status pills, metrics. */
export type AivoTone =
  | "neutral"
  | "primary"
  | "accent"
  | "warm"
  | "success"
  | "warning"
  | "error"
  | "info";

/** Density preset — controls padding scale on cards, panels, sheets. */
export type AivoDensity = "compact" | "base" | "comfortable";

/** Elevation preset — controls shadow + border weight on surfaces. */
export type AivoElevation = "flat" | "raised" | "floating" | "overlay";

/** Radius preset — maps to the iw-* radius tokens. */
export type AivoRadius =
  | "control"
  | "card"
  | "card-lg"
  | "hero"
  | "chip"
  | "sheet-top";
