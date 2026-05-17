/**
 * Sprint 10 (Tasks #119, #198, #199) — URL-mirroring filter helpers.
 *
 * Admin pages have a recurring shape: a small bag of filter / pagination
 * state that the operator wants to bookmark. Without URL sync, a deep link
 * or refresh resets the filters. These helpers keep React state and
 * URLSearchParams in lock-step:
 *
 *   - `readParamString`, `readParamNumber`, `readParamArray` — read initial
 *     state from a URL or window.location on mount. Pure functions; no
 *     React or DOM dependency at the call site, just hand them
 *     URLSearchParams (or null when SSR).
 *   - `useSyncFiltersToUrl` — replaces the current history entry whenever
 *     the supplied params record changes. Only writes when the serialised
 *     query actually differs, so it's safe to call on every render.
 *
 * Helpers are pure so they can be unit-tested with the existing
 * `tsx --test` harness.
 */
import { useEffect, useMemo } from "react";

export type FilterParamValue = string | number | string[] | undefined | null;

/** Read a single string param, returning `fallback` when missing/blank. */
export function readParamString(
  params: URLSearchParams | null,
  key: string,
  fallback = "",
): string {
  if (!params) return fallback;
  const v = params.get(key);
  if (v === null || v === "") return fallback;
  return v;
}

/** Read a numeric param, returning `fallback` when missing or unparseable. */
export function readParamNumber(
  params: URLSearchParams | null,
  key: string,
  fallback: number,
): number {
  if (!params) return fallback;
  const v = params.get(key);
  if (v === null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Read a comma- or repeat-separated array param. Both `?s=a,b` and
 * `?s=a&s=b` produce `["a", "b"]`. Returns `fallback` when missing.
 */
export function readParamArray(
  params: URLSearchParams | null,
  key: string,
  fallback: string[] = [],
): string[] {
  if (!params) return fallback;
  const all = params.getAll(key);
  if (all.length === 0) return fallback;
  const out: string[] = [];
  for (const v of all) {
    for (const part of v.split(",")) {
      const t = part.trim();
      if (t.length > 0) out.push(t);
    }
  }
  return out.length > 0 ? out : fallback;
}

/** Read a `URLSearchParams` from the current window, or `null` on the server. */
export function readWindowSearchParams(): URLSearchParams | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search);
}

/**
 * Serialise a filters record into a URLSearchParams. Empty / null values
 * and arrays of length zero are omitted. Arrays are joined with commas
 * (not repeated) so the resulting URL stays compact.
 */
export function serializeFilters(values: Record<string, FilterParamValue>): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of Object.keys(values).sort()) {
    const v = values[key];
    if (v === undefined || v === null) continue;
    if (typeof v === "string") {
      if (v.length === 0) continue;
      params.set(key, v);
      continue;
    }
    if (typeof v === "number") {
      if (!Number.isFinite(v)) continue;
      params.set(key, String(v));
      continue;
    }
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      params.set(key, v.join(","));
      continue;
    }
  }
  return params;
}

/**
 * Mirror `values` into the current window's location whenever they change.
 * Uses `history.replaceState` so the back button still goes to the
 * previous page. No-op on the server.
 *
 * The hook reads the existing query first and only writes when the
 * serialised string actually differs, so multiple instances on the same
 * page (or React 18 strict-mode double-render) are idempotent.
 */
export function useSyncFiltersToUrl(values: Record<string, FilterParamValue>): void {
  const next = useMemo(() => serializeFilters(values).toString(), [values]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const current = window.location.search.replace(/^\?/, "");
    if (current === next) return;
    const url =
      next.length > 0
        ? `${window.location.pathname}?${next}${window.location.hash}`
        : `${window.location.pathname}${window.location.hash}`;
    window.history.replaceState(null, "", url);
  }, [next]);
}
