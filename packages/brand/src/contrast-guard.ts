/**
 * White-label contrast guard (Sprint B6).
 *
 * A district's brand palette must never degrade accessibility, so every
 * candidate primary/secondary color is checked against the brand's REAL
 * text/surface tokens in both the light theme (card + page surfaces) and
 * the dark chrome (inverse surface) before it can be saved:
 *
 *   1. color as TEXT on the light surfaces      → WCAG AA ≥ 4.5:1
 *   2. white text ON the color (primary button) → WCAG AA ≥ 4.5:1
 *   3. color as UI accent on the dark chrome    → WCAG 1.4.11 ≥ 3.0:1
 *      (accents on dark surfaces render as large text / non-text UI,
 *      which is what the 3:1 non-text threshold governs)
 *
 * Failures are returned as specific, human-readable messages
 * ("primary on light surface fails: 2.9:1 (needs 4.5:1)") — the admin
 * UI shows them live and the identity-svc write route rejects with them.
 * Pure TS, safe in client components.
 */
import { SEMANTIC } from "./tokens.js";

export const CONTRAST_AA_NORMAL = 4.5;
export const CONTRAST_NON_TEXT = 3.0;

/** The surfaces a tenant accent actually lands on, from the live tokens. */
export const GUARD_SURFACES = {
  lightCard: SEMANTIC.color.surface.card,
  lightPage: SEMANTIC.color.surface.page,
  darkChrome: SEMANTIC.color.surface.inverse,
  textOnColor: SEMANTIC.color.text.inverse,
} as const;

export function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG 2.1 contrast ratio between two hex colors; null on bad input. */
export function contrastRatio(aHex: string, bHex: string): number | null {
  const a = hexToRgb(aHex);
  const b = hexToRgb(bHex);
  if (!a || !b) return null;
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export interface ContrastFailure {
  /** Which brand slot failed ("primary" | "secondary"). */
  slot: string;
  /** Human context, e.g. "on light surface". */
  context: string;
  ratio: number;
  required: number;
  message: string;
}

export interface PaletteVerdict {
  ok: boolean;
  failures: ContrastFailure[];
  /** Per-check ratios for the live preview UI (including passes). */
  checks: Array<ContrastFailure & { passed: boolean }>;
}

function checksFor(slot: string, hex: string): Array<ContrastFailure & { passed: boolean }> {
  const make = (context: string, against: string, required: number) => {
    const ratio = contrastRatio(hex, against) ?? 0;
    const passed = ratio >= required;
    return {
      slot,
      context,
      ratio,
      required,
      passed,
      message: `${slot} ${context} ${passed ? "passes" : "fails"}: ${ratio.toFixed(2)}:1 (needs ${required}:1)`,
    };
  };
  return [
    make("on light surface", GUARD_SURFACES.lightCard, CONTRAST_AA_NORMAL),
    make("on page background", GUARD_SURFACES.lightPage, CONTRAST_AA_NORMAL),
    make("under white text", GUARD_SURFACES.textOnColor, CONTRAST_AA_NORMAL),
    make("on dark chrome", GUARD_SURFACES.darkChrome, CONTRAST_NON_TEXT),
  ];
}

/**
 * Validate a tenant palette. `secondaryColor` is optional; an absent or
 * empty slot is skipped (the default token remains in effect).
 */
export function evaluateBrandPalette(palette: {
  primaryColor?: string | null;
  secondaryColor?: string | null;
}): PaletteVerdict {
  const checks: Array<ContrastFailure & { passed: boolean }> = [];
  for (const [slot, value] of [
    ["primary", palette.primaryColor],
    ["secondary", palette.secondaryColor],
  ] as const) {
    if (!value || !value.trim()) continue;
    if (!hexToRgb(value)) {
      checks.push({
        slot,
        context: "hex format",
        ratio: 0,
        required: 0,
        passed: false,
        message: `${slot} must be a hex color (#RRGGBB)`,
      });
      continue;
    }
    checks.push(...checksFor(slot, value.trim()));
  }
  const failures = checks.filter((check) => !check.passed);
  return { ok: failures.length === 0, failures, checks };
}

/**
 * Derive hover/active shades from a brand hex (multiplicative darken) so
 * a single tenant color still produces visible interaction feedback.
 */
export function shadeHex(hex: string, factor: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${rgb.map((c) => clamp(c * factor).toString(16).padStart(2, "0")).join("")}`;
}
