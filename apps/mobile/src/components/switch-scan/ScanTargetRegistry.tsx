/**
 * Switch-scan target registry (Sprint A4).
 *
 * The SwitchScanOverlay used to be mounted with `items={[]}` — rendered but
 * non-functional. Screens now REGISTER their primary actions here and the
 * overlay scans the live set: highlight follows the target's measured
 * on-screen rect, each focus is announced to the screen reader, and
 * activation invokes the target's own handler.
 *
 * Ordering/cleanup mechanics live in scan-target-store.ts (pure,
 * unit-tested); this file is the thin React binding.
 */
import React, { createContext, useContext, useRef, useSyncExternalStore } from "react";
import type { View } from "react-native";
import {
  createScanTargetStore,
  type ScanTarget,
  type ScanTargetRect,
  type ScanTargetStore,
} from "./scan-target-store";

export type { ScanTarget, ScanTargetRect };

const ScanTargetContext = createContext<ScanTargetStore | null>(null);

export function ScanTargetProvider({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<ScanTargetStore | null>(null);
  storeRef.current ??= createScanTargetStore();
  return (
    <ScanTargetContext.Provider value={storeRef.current}>{children}</ScanTargetContext.Provider>
  );
}

const EMPTY: readonly ScanTarget[] = [];

/** Overlay-side: live, ordered scan target list. */
export function useScanTargets(): readonly ScanTarget[] {
  const store = useContext(ScanTargetContext);
  return useSyncExternalStore(
    store?.subscribe ?? (() => () => undefined),
    store?.getTargets ?? (() => EMPTY),
    store?.getTargets ?? (() => EMPTY),
  );
}

/**
 * Screen-side: register one scannable action. Attach the returned `ref` to
 * the target's View/Pressable. No-ops cleanly outside the provider (e.g.
 * a component reused on a non-learner surface).
 */
export function useScanTarget(input: {
  id: string;
  label: string;
  order: number;
  onActivate: () => void;
  disabled?: boolean;
}) {
  const store = useContext(ScanTargetContext);
  const ref = useRef<View | null>(null);
  const inputRef = useRef(input);
  inputRef.current = input;

  React.useEffect(() => {
    if (!store || input.disabled) return;
    return store.register({
      id: input.id,
      label: input.label,
      order: input.order,
      onActivate: () => inputRef.current.onActivate(),
      measure: () =>
        new Promise((resolvePromise) => {
          const node = ref.current;
          if (!node || typeof node.measureInWindow !== "function") {
            resolvePromise(null);
            return;
          }
          node.measureInWindow((x, y, width, height) =>
            resolvePromise(Number.isFinite(x) && width > 0 ? { x, y, width, height } : null),
          );
        }),
    });
    // label/order changes re-register; onActivate swaps via inputRef.
  }, [store, input.id, input.label, input.order, input.disabled]);

  return ref;
}
