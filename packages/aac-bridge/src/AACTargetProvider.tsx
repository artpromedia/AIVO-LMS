/**
 * AAC target registry + provider (Sprint 7).
 *
 * The existing `useAACInput` hook in this package takes a fixed
 * `SymbolItem[]` (image, audio, board metadata) and drives a single
 * scanner over it. That is the right abstraction for a dedicated
 * communication board, but it is too heavy for wrapping generic
 * learner-UI controls (choice buttons, submit buttons, tutor-chat
 * "Send", lesson-player "Next").
 *
 * This module exposes a lighter-weight contract:
 *
 *   - `AACTargetProvider`: React context that holds the set of
 *     currently-scannable targets. Mounted by the lesson player and
 *     the tutor / homework chat composers when the learner has
 *     `aacEnabled === true` in their accessibility prefs.
 *   - `useAACTarget(id, label, onActivate)`: register a single
 *     focusable target with the provider. Returns a `ref` that the
 *     consumer attaches to the element it wants the scanner to focus,
 *     plus an `isHighlighted` boolean for visual styling.
 *   - `AACScanRoot`: optional wrapper component that listens for the
 *     activation key (Space) and forwards it to the provider's
 *     activate() — keyboard-only switch-scan in one prop.
 *
 * The provider drives focus by translating each registered target
 * into a synthetic SymbolItem and feeding it to the SwitchScanController
 * already in this package. That keeps the scanner logic single-sourced.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { SwitchScanController } from "./SwitchScanController.js";
import type { AACEvent, AACInputMethod, AACSessionConfig, SymbolItem } from "./types.js";

export interface AACTargetRegistration {
  id: string;
  label: string;
  onActivate: () => void;
  /** Optional DOM element ref the provider focuses when this target
   *  becomes the highlighted one. Auto-attached when consumers use the
   *  returned `ref` from `useAACTarget`. */
  element?: HTMLElement | null;
}

export interface AACProviderContextValue {
  enabled: boolean;
  highlightedId: string | null;
  /** Register a target with the scanner. Returns an unregister fn. */
  register: (target: AACTargetRegistration) => () => void;
  /** Update the DOM element for an already-registered target. */
  attachElement: (id: string, element: HTMLElement | null) => void;
  /** Trigger the activate() flow on the currently highlighted target. */
  activate: () => void;
  /** Manual advance — used by 2-switch mode and keyboard fallback. */
  advance: () => void;
  /** Most recent activation event, useful for telemetry. */
  lastEvent: AACEvent | null;
}

const NULL_CONTEXT: AACProviderContextValue = {
  enabled: false,
  highlightedId: null,
  register: () => () => {},
  attachElement: () => {},
  activate: () => {},
  advance: () => {},
  lastEvent: null,
};

const AACContext = createContext<AACProviderContextValue>(NULL_CONTEXT);

export interface AACTargetProviderProps {
  enabled: boolean;
  inputMethod: AACInputMethod;
  scanDelayMs?: number;
  dwellTimeMs?: number;
  auditoryFeedback?: boolean;
  highlightStyle?: AACSessionConfig["highlightStyle"];
  children: ReactNode;
  /** Telemetry hook for activation events; lets the lesson player log
   *  AAC selections without coupling the bridge to the BFF. */
  onEvent?: (event: AACEvent) => void;
  /**
   * Whether the scanner advances on its own timer (auto-scan). Defaults
   * to `true`, preserving the original single-source behaviour: a switch
   * session auto-advances and the learner activates with one switch.
   *
   * Set `false` for genuine two-switch *step* scanning, where one switch
   * advances (`advance()` / ArrowRight) and the other selects
   * (`activate()` / Space) — there the timer must NOT run, or the
   * highlight would drift out from under the learner between presses.
   * When omitted, callers can pass `inputMethod === "switch_2" ? false`
   * to get step scanning. Has no effect for non-switch methods (which
   * never start the timer).
   */
  autoScan?: boolean;
  /**
   * Fires whenever the highlighted target changes (including on the
   * initial highlight and when the highlight clears to `null`). The
   * baseline runner uses this to optionally speak the focused choice via
   * its existing TTS path so a switch user hears each option as it lands
   * — read-aloud paired with scan focus. Receives the highlighted
   * target's id and its label, or `(null, null)` when nothing is
   * highlighted. Kept label-level (not audio-owning) so the bridge stays
   * free of any TTS dependency.
   */
  onHighlightChange?: (id: string | null, label: string | null) => void;
}

interface InternalTarget {
  id: string;
  label: string;
  onActivate: () => void;
  element: HTMLElement | null;
  /** Insertion order so the scanner walks targets in DOM order. */
  order: number;
}

export function AACTargetProvider({
  enabled,
  inputMethod,
  scanDelayMs = 1000,
  dwellTimeMs = 800,
  auditoryFeedback = false,
  highlightStyle = "box",
  children,
  onEvent,
  autoScan = true,
  onHighlightChange,
}: AACTargetProviderProps) {
  const targetsRef = useRef<Map<string, InternalTarget>>(new Map());
  const orderRef = useRef<number>(0);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<AACEvent | null>(null);
  const controllerRef = useRef<SwitchScanController | null>(null);
  // Keep the highlight callback in a ref so changing it doesn't tear down
  // and rebuild the scanner (which would reset the highlight to index 0).
  const onHighlightChangeRef = useRef(onHighlightChange);
  onHighlightChangeRef.current = onHighlightChange;

  const sessionConfig: AACSessionConfig = useMemo(
    () => ({
      method: inputMethod,
      scanDelayMs,
      dwellTimeMs,
      auditoryFeedback,
      highlightStyle,
      // Step scanning (two-switch) must not run the auto-advance timer;
      // the learner advances manually. Auto-scan keeps `autoStart: true`
      // so the SwitchScanController drives the timer as before.
      autoStart: autoScan,
    }),
    [inputMethod, scanDelayMs, dwellTimeMs, auditoryFeedback, highlightStyle, autoScan],
  );

  // Snapshot of current targets in stable order, fed to the SwitchScanController.
  const [tick, setTick] = useState(0);
  const orderedSymbols: SymbolItem[] = useMemo(() => {
    return Array.from(targetsRef.current.values())
      .sort((a, b) => a.order - b.order)
      .map((t) => ({
        id: t.id,
        label: t.label,
        imageUrl: "",
        boardId: "aivo-ui-targets",
        position: { row: 0, col: t.order },
      }));
    // `tick` triggers recomputation when register/unregister fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  useEffect(() => {
    if (!enabled) {
      setHighlightedId(null);
      onHighlightChangeRef.current?.(null, null);
      return undefined;
    }
    if (orderedSymbols.length === 0) return undefined;

    // Touch / eye-gaze / head-pointer paths do not use the SwitchScan
    // timer; targets are activated directly by their own pointer / dwell
    // handlers (mounted by consumers via useAACTarget's onActivate).
    if (sessionConfig.method !== "switch_1" && sessionConfig.method !== "switch_2") {
      return undefined;
    }

    const ctrl = new SwitchScanController(sessionConfig, orderedSymbols);
    controllerRef.current = ctrl;
    const applyHighlight = (item: SymbolItem | null) => {
      setHighlightedId(item?.id ?? null);
      const t = item ? targetsRef.current.get(item.id) : null;
      if (t?.element && typeof t.element.focus === "function") {
        // Focus moves with no animation — the highlight ring is the only
        // visual change, so reduced-motion learners see no transition.
        t.element.focus({ preventScroll: false });
      }
      onHighlightChangeRef.current?.(item?.id ?? null, t?.label ?? item?.label ?? null);
    };
    const unsub = ctrl.subscribe(applyHighlight);
    ctrl.start();
    // The controller only `_notify`s on advance, so seed the initial
    // highlight (index 0) explicitly. This matters for step-scan
    // (`autoScan === false`), where no timer ever fires the first
    // notification — the first switch press should still find a target
    // already highlighted.
    applyHighlight(ctrl.getHighlightedItem());
    return () => {
      ctrl.stop();
      unsub();
      controllerRef.current = null;
    };
  }, [enabled, orderedSymbols, sessionConfig]);

  const register = useCallback<AACProviderContextValue["register"]>((target) => {
    const order = orderRef.current++;
    targetsRef.current.set(target.id, {
      id: target.id,
      label: target.label,
      onActivate: target.onActivate,
      element: target.element ?? null,
      order,
    });
    setTick((n) => n + 1);
    return () => {
      targetsRef.current.delete(target.id);
      setTick((n) => n + 1);
    };
  }, []);

  const attachElement = useCallback<AACProviderContextValue["attachElement"]>((id, element) => {
    const t = targetsRef.current.get(id);
    if (t) t.element = element;
  }, []);

  const advance = useCallback(() => {
    controllerRef.current?.advance();
  }, []);

  const activate = useCallback(() => {
    if (!enabled) return;
    const ctrl = controllerRef.current;
    if (ctrl) {
      const evt = ctrl.activate();
      setLastEvent(evt);
      onEvent?.(evt);
      const t = targetsRef.current.get(evt.targetId);
      t?.onActivate();
      return;
    }
    // Non-scanning input methods: activate whatever is currently
    // highlighted (touch / eye-gaze dwell sets highlightedId out-of-band).
    if (highlightedId) {
      const t = targetsRef.current.get(highlightedId);
      if (!t) return;
      const evt: AACEvent = {
        method: sessionConfig.method,
        targetId: t.id,
        timestamp: Date.now(),
      };
      setLastEvent(evt);
      onEvent?.(evt);
      t.onActivate();
    }
  }, [enabled, highlightedId, onEvent, sessionConfig.method]);

  const ctx: AACProviderContextValue = useMemo(
    () => ({
      enabled,
      highlightedId,
      register,
      attachElement,
      activate,
      advance,
      lastEvent,
    }),
    [enabled, highlightedId, register, attachElement, activate, advance, lastEvent],
  );

  return <AACContext.Provider value={ctx}>{children}</AACContext.Provider>;
}

export interface UseAACTargetResult {
  /** Attach to the focusable element. */
  ref: (node: HTMLElement | null) => void;
  /** True when the scanner currently highlights this target. */
  isHighlighted: boolean;
  /** True when an AAC provider is mounted upstream AND enabled. */
  aacActive: boolean;
}

/**
 * Register a UI control as an AAC target. The hook is safe to call even
 * when no provider is mounted — it returns a no-op ref and
 * `aacActive: false`, so consumers can wrap every focusable element
 * unconditionally.
 */
export function useAACTarget(
  id: string,
  label: string,
  onActivate: () => void,
): UseAACTargetResult {
  const ctx = useContext(AACContext);
  const elementRef = useRef<HTMLElement | null>(null);
  const onActivateRef = useRef(onActivate);
  onActivateRef.current = onActivate;

  useEffect(() => {
    if (!ctx.enabled) return undefined;
    const unregister = ctx.register({
      id,
      label,
      onActivate: () => onActivateRef.current(),
      element: elementRef.current,
    });
    return unregister;
  }, [ctx, id, label]);

  const ref = useCallback(
    (node: HTMLElement | null) => {
      elementRef.current = node;
      if (ctx.enabled) ctx.attachElement(id, node);
    },
    [ctx, id],
  );

  return {
    ref,
    isHighlighted: ctx.highlightedId === id,
    aacActive: ctx.enabled,
  };
}

export function useAACContext(): AACProviderContextValue {
  return useContext(AACContext);
}

export interface AACScanRootProps {
  /** Keyboard key(s) that fire `activate()`. Default Space. Accepts an
   *  array so a host can map both Space and Enter to "select" (the
   *  standard switch-select fallback). */
  activateKey?: string | string[];
  /** Keyboard key(s) that advance the scanner (used in 2-switch step
   *  scanning). Default ArrowRight. */
  advanceKey?: string | string[];
  children: ReactNode;
}

/**
 * Wrapper element that listens for the activation key globally and
 * forwards it to the provider's `activate()`. Drop one of these around
 * the lesson-player root and a learner using a single-switch device
 * (mapped to Space) can complete a lesson with the keyboard alone.
 *
 * For two-switch step scanning, map the second switch to `advanceKey`
 * (default ArrowRight) and pair it with `<AACTargetProvider autoScan={false}>`.
 */
export function AACScanRoot({
  activateKey = " ",
  advanceKey = "ArrowRight",
  children,
}: AACScanRootProps) {
  const ctx = useContext(AACContext);
  const enabled = ctx.enabled;
  const activate = ctx.activate;
  const advance = ctx.advance;

  useEffect(() => {
    if (!enabled) return undefined;
    const activateKeys = Array.isArray(activateKey) ? activateKey : [activateKey];
    const advanceKeys = Array.isArray(advanceKey) ? advanceKey : [advanceKey];
    function onKey(e: KeyboardEvent) {
      // Don't hijack typing into a text field (the baseline's free-text
      // answer input) — a switch user on a choice question never focuses
      // it, but a low-vision keyboard user might, and Space/Enter there
      // must behave normally.
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTextEntry =
        tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable === true;
      if (isTextEntry) return;
      if (activateKeys.includes(e.key)) {
        e.preventDefault();
        activate();
      } else if (advanceKeys.includes(e.key)) {
        e.preventDefault();
        advance();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, activate, advance, activateKey, advanceKey]);

  return <>{children}</>;
}
