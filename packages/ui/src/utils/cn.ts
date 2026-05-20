import { clsx, type ClassValue } from "clsx";

/**
 * Tiny class composer — same signature as `clsx`, re-exported so AIVO UI
 * consumers never need to add `clsx` themselves.
 *
 * Tailwind-merge is intentionally NOT included: AIVO UI primitives are
 * additive — callers extend via `className`, but never *override* token-
 * level utilities (e.g. you cannot replace `bg-iw-card` with `bg-red-500`).
 * If you need a non-token surface, compose a new primitive instead.
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
