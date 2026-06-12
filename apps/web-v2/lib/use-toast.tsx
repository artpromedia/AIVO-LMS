"use client";

/**
 * Imperative toast store + hook.
 *
 * `toast({ title, description?, variant?, action? })` from any client
 * component; `<Toaster />` (components/ui/toaster.tsx, mounted once in the
 * root layout) renders the queue on the existing Radix primitives.
 *
 * Conventions:
 *   - strings arrive already translated (pages own their namespaces);
 *   - "danger" renders as an assertive alert; everything else is polite;
 *   - max 3 visible — older toasts drop first (no stacking walls);
 *   - durations come from the caller or default to 6s (long enough to read,
 *     dismissible sooner). Motion is inherited from the Radix primitives,
 *     which respect the global reduced-motion CSS kill-switch.
 */
import * as React from "react";

export type ToastVariant = "default" | "success" | "danger";

export interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Optional action button (label + handler), e.g. a retry. */
  action?: { label: string; onClick: () => void };
  durationMs?: number;
}

export interface ToastRecord extends ToastInput {
  id: string;
  variant: ToastVariant;
  durationMs: number;
}

const MAX_VISIBLE = 3;
const DEFAULT_DURATION_MS = 6_000;

type Listener = (toasts: ToastRecord[]) => void;

let queue: ToastRecord[] = [];
const listeners = new Set<Listener>();
let counter = 0;

function emit(): void {
  for (const l of listeners) l(queue);
}

export function toast(input: ToastInput): string {
  const id = `toast-${++counter}`;
  const record: ToastRecord = {
    id,
    variant: input.variant ?? "default",
    durationMs: input.durationMs ?? DEFAULT_DURATION_MS,
    title: input.title,
    description: input.description,
    action: input.action,
  };
  queue = [...queue, record].slice(-MAX_VISIBLE);
  emit();
  return id;
}

export function dismissToast(id: string): void {
  queue = queue.filter((t) => t.id !== id);
  emit();
}

/** Test-only: empty the queue between cases. */
export function _resetToasts(): void {
  queue = [];
  emit();
}

export function useToastQueue(): ToastRecord[] {
  return React.useSyncExternalStore(
    (cb) => {
      const l: Listener = () => cb();
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => queue,
    () => queue,
  );
}
