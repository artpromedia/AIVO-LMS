"use client";

/**
 * Sprint C-15 — switch / AAC scanning for the baseline runner.
 *
 * The runner (`page.tsx`) is a React Server Component whose controls submit
 * through native forms and links — choice cards are `<input type=radio>` in a
 * `<label>`, Skip/Next/Finish are `<button type=submit>`, Stop-for-today /
 * Resume are `<a>` links. A learner using a single switch (mapped to Space) or
 * two switches (Space = select, ArrowRight = advance) must be able to reach and
 * operate every one of them with no pointer and no Tab.
 *
 * This client island mounts the SAME mechanism the lesson player uses
 * (`@aivo/aac-bridge`'s `AACTargetProvider` + `AACScanRoot`, which wrap the
 * package's single-source `SwitchScanController`) around the runner body —
 * NOT a parallel scanner. The one piece the bridge leaves to the host is the
 * target registry; the lesson player registers each control with
 * `useAACTarget` from inside client surfaces. The baseline's controls are
 * server-rendered, so instead of converting each to a client component we
 * discover them from the DOM in document order via a `[data-scan-target]`
 * attribute and register them with the provider context. DOM order is reading
 * order is scan order (the sprint's rule) and React renders siblings in DOM
 * order, so this stays faithful without any manual ordering.
 *
 * Honored design constraints:
 *   - Auto-scan (single switch) vs. step-scan (two switches) via the bridge's
 *     `autoScan` prop; dwell from the learner's persisted pref (baseline floor
 *     applied in `resolveBaselineScanConfig`).
 *   - The Skip control is registered first so it is reached before any answer
 *     (no-fail: skipping is never harder than answering).
 *   - High-contrast scan-focus ring via `data-scan-current`; focus moves with
 *     no animation, and the ring is suppressed under `prefers-reduced-motion`
 *     only for its transition (the ring itself stays visible) — the highlight
 *     never animates.
 *   - Read-aloud pairing: when the learner is audio-first, the focused target's
 *     label is spoken via the browser Speech API (the same API the existing
 *     read-aloud control uses). Off by default.
 *   - A polite live region announces the highlighted control for AT users.
 */
import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AACScanRoot, AACTargetProvider, useAACContext } from "@aivo/aac-bridge";
import type { ReactNode } from "react";
import type { BaselineScanConfig } from "@/lib/a11y/baseline-scan";

/** Marker attributes a server-rendered control carries to opt into scanning.
 *  Exported so the runner and tests reference the same string literals. */
export const SCAN_TARGET_ATTR = "data-scan-target";
export const SCAN_LABEL_ATTR = "data-scan-label";
export const SCAN_ACTION_ATTR = "data-scan-action";
export const SCAN_CURRENT_ATTR = "data-scan-current";

/** Speak `text` via the browser Speech API, cancelling anything in flight.
 *  No-op when unsupported (SSR / unsupported browser) so it never throws. */
function speak(text: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const trimmed = text.trim();
  if (!trimmed) return;
  const utterance = new SpeechSynthesisUtterance(trimmed);
  synth.speak(utterance);
}

/**
 * Discovers `[data-scan-target]` elements within the runner body in DOM order
 * and registers them with the AAC provider. Re-discovers whenever the runner's
 * DOM changes (new question after a submit) via a MutationObserver, so the
 * scanner always reflects the controls currently on screen.
 */
function ScanRegistrar({
  scopeRef,
  speakOnFocus,
  onAnnounce,
}: {
  scopeRef: React.RefObject<HTMLDivElement | null>;
  speakOnFocus: boolean;
  onAnnounce: (label: string | null) => void;
}) {
  const ctx = useAACContext();
  const { enabled, register, attachElement, highlightedId } = ctx;

  // Re-run registration when the set of targets in the DOM changes. A bump
  // counter lets the MutationObserver trigger a fresh registration pass.
  const [domVersion, setDomVersion] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    const scope = scopeRef.current;
    if (!scope) return undefined;

    const els = Array.from(scope.querySelectorAll<HTMLElement>(`[${SCAN_TARGET_ATTR}]`)).filter(
      (el) => {
        // Skip hidden/disabled controls — a disabled Next button must not be a
        // dead stop in the cycle.
        if (el.hasAttribute("disabled")) return false;
        if (el.getAttribute("aria-disabled") === "true") return false;
        return true;
      },
    );

    const unregisters = els.map((el, i) => {
      const id = el.getAttribute(SCAN_TARGET_ATTR) || `scan-${i}`;
      const label = el.getAttribute(SCAN_LABEL_ATTR) || el.textContent?.trim() || id;
      const action = el.getAttribute(SCAN_ACTION_ATTR);
      // Make the element focusable for the bridge's focus() call without
      // adding it to the Tab order (scan users don't Tab).
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
      const onActivate = () => {
        if (action === "read-aloud") {
          // Read-aloud activates its own audio rather than navigating away.
          const toRead = el.getAttribute("data-scan-read") || label;
          speak(toRead);
          return;
        }
        // Native default: button submits its form, label checks its radio,
        // anchor follows its href (Next.js intercepts the click for routing).
        el.click();
      };
      const unregister = register({ id, label, onActivate, element: el });
      attachElement(id, el);
      return unregister;
    });

    return () => {
      for (const u of unregisters) u();
    };
    // `domVersion` forces a re-scan when the runner DOM mutates (new question,
    // hint opened, break screen). `register`/`attachElement` are stable from
    // the provider context; `scopeRef` is a stable ref.
  }, [enabled, register, attachElement, scopeRef, domVersion]);

  // Watch for DOM changes (question → next question, break screen) and
  // re-register ONLY when the set of scannable targets actually changes.
  // Re-registering rebuilds the SwitchScanController (resetting it to the
  // first target), so we must not do it on incidental mutations — e.g. the
  // hint panel opening adds no new target, and the highlight reflection writes
  // `data-scan-current` on every advance. We therefore (a) do not observe
  // `attributes`, and (b) compare the target-id signature before bumping.
  const lastSignatureRef = useRef<string>("");
  useEffect(() => {
    if (!enabled) return undefined;
    const scope = scopeRef.current;
    if (!scope || typeof MutationObserver === "undefined") return undefined;
    const signature = () =>
      Array.from(scope.querySelectorAll<HTMLElement>(`[${SCAN_TARGET_ATTR}]`))
        .map((el) => el.getAttribute(SCAN_TARGET_ATTR))
        .join("|");
    lastSignatureRef.current = signature();
    let raf = 0;
    const obs = new MutationObserver(() => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const sig = signature();
        if (sig !== lastSignatureRef.current) {
          lastSignatureRef.current = sig;
          setDomVersion((v) => v + 1);
        }
      });
    });
    obs.observe(scope, { childList: true, subtree: true });
    return () => {
      obs.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [enabled, scopeRef]);

  // Reflect the highlighted target onto the DOM (the scan-focus ring keys off
  // `data-scan-current`) and announce / optionally speak it.
  useEffect(() => {
    if (!enabled) return;
    const scope = scopeRef.current;
    if (!scope) return;
    let currentLabel: string | null = null;
    scope.querySelectorAll<HTMLElement>(`[${SCAN_CURRENT_ATTR}]`).forEach((el) => {
      el.removeAttribute(SCAN_CURRENT_ATTR);
    });
    if (highlightedId) {
      // Match by attribute VALUE without a CSS attribute-selector so we don't
      // depend on CSS.escape (absent in some test DOMs) and never break on a
      // target id containing selector-special characters.
      const el = Array.from(scope.querySelectorAll<HTMLElement>(`[${SCAN_TARGET_ATTR}]`)).find(
        (node) => node.getAttribute(SCAN_TARGET_ATTR) === highlightedId,
      );
      if (el) {
        el.setAttribute(SCAN_CURRENT_ATTR, "true");
        currentLabel = el.getAttribute(SCAN_LABEL_ATTR) || el.textContent?.trim() || highlightedId;
      }
    }
    onAnnounce(currentLabel);
    if (speakOnFocus && currentLabel) speak(currentLabel);
  }, [enabled, highlightedId, scopeRef, speakOnFocus, onAnnounce]);

  return null;
}

export interface BaselineScanProviderProps {
  config: BaselineScanConfig;
  /** True when the learner is audio-first → speak the focused control. */
  speakOnFocus: boolean;
  /** Localized hint shown to scan users explaining the two-switch keys. */
  scanHelpText: string;
  /** Localized live-region template; receives the focused control's label. */
  announceTemplate: (label: string) => string;
  children: ReactNode;
}

/**
 * Wraps the runner body. When `config.active` is false (the learner is not in
 * a switch input mode) it renders children untouched, so the standard
 * pointer/keyboard runner is completely unchanged for everyone else.
 */
export function BaselineScanProvider({
  config,
  speakOnFocus,
  scanHelpText,
  announceTemplate,
  children,
}: BaselineScanProviderProps) {
  const scopeRef = useRef<HTMLDivElement | null>(null);
  const [announce, setAnnounce] = useState<string | null>(null);

  const handleAnnounce = useCallback((label: string | null) => {
    setAnnounce(label);
  }, []);

  if (!config.active) {
    return <>{children}</>;
  }

  return (
    <AACTargetProvider
      enabled
      inputMethod={config.inputMethod}
      scanDelayMs={config.scanDelayMs}
      autoScan={config.autoScan}
      auditoryFeedback={speakOnFocus}
    >
      {/* Space = select; ArrowRight = advance (two-switch step scan). */}
      <AACScanRoot activateKey={[" ", "Enter"]} advanceKey={["ArrowRight", "ArrowDown"]}>
        <div ref={scopeRef} data-scan-scope="baseline">
          {children}
        </div>
        <ScanRegistrar
          scopeRef={scopeRef}
          speakOnFocus={speakOnFocus}
          onAnnounce={handleAnnounce}
        />
        {/* Quiet helper + live region for AT users. The helper text is
            non-visual clutter-free: it sits in a small muted bar so a sighted
            switch user also sees how to advance. */}
        <p className="mt-4 text-center text-xs text-iw-text-muted" data-scan-help>
          {scanHelpText}
        </p>
        <p className="sr-only" role="status" aria-live="polite">
          {announce ? announceTemplate(announce) : ""}
        </p>
      </AACScanRoot>
    </AACTargetProvider>
  );
}
