/**
 * Pure scan-target store backing ScanTargetProvider (Sprint A4).
 * Extracted so the ordering/cleanup contract is unit-testable without a
 * React renderer (mobile's vitest suite is logic-level).
 */
export interface ScanTargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScanTarget {
  id: string;
  /** Announced via the live region when the scan highlights this target. */
  label: string;
  /** Visual order; lower scans first. Ties resolve by registration order. */
  order: number;
  onActivate: () => void;
  /** Measured just-in-time so layout changes don't stale the highlight. */
  measure: () => Promise<ScanTargetRect | null>;
}

export interface ScanTargetStore {
  register: (target: ScanTarget) => () => void;
  subscribe: (listener: () => void) => () => void;
  getTargets: () => readonly ScanTarget[];
}

export function createScanTargetStore(): ScanTargetStore {
  const entries = new Map<string, { target: ScanTarget; seq: number }>();
  let seq = 0;
  let snapshot: readonly ScanTarget[] = [];
  const listeners = new Set<() => void>();

  function notify(): void {
    snapshot = [...entries.values()]
      .sort((a, b) => a.target.order - b.target.order || a.seq - b.seq)
      .map((entry) => entry.target);
    for (const listener of listeners) listener();
  }

  return {
    register(target) {
      entries.set(target.id, { target, seq: (seq += 1) });
      notify();
      return () => {
        entries.delete(target.id);
        notify();
      };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getTargets: () => snapshot,
  };
}
