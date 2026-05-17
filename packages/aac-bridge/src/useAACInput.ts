/**
 * useAACInput — React hook that unifies AAC input methods behind a single API.
 * React is an optional peer dependency; this file must only be imported in
 * React environments.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import type { AACEvent, AACSessionConfig, SymbolItem } from "./types.js";
import { SwitchScanController } from "./SwitchScanController.js";

export interface UseAACInputResult {
  highlightedId: string | null;
  onActivate: () => void;
  currentEvent: AACEvent | null;
}

export function useAACInput(
  config: AACSessionConfig,
  items: SymbolItem[],
): UseAACInputResult {
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [currentEvent, setCurrentEvent] = useState<AACEvent | null>(null);
  const controllerRef = useRef<SwitchScanController | null>(null);

  useEffect(() => {
    if (config.method === "switch_1" || config.method === "switch_2") {
      const ctrl = new SwitchScanController(config, items);
      controllerRef.current = ctrl;
      const unsub = ctrl.subscribe((item) => setHighlightedId(item?.id ?? null));
      ctrl.start();
      return () => {
        ctrl.stop();
        unsub();
        controllerRef.current = null;
      };
    }

    if (config.method === "eye_gaze") {
      console.warn(
        "[aac-bridge] Eye-gaze mode requires a Tobii or MyTobii vendor SDK. " +
          "Use TobiiAdapter from @aivo/aac-bridge/adapters for full integration.",
      );
    }

    return undefined;
  }, [config, items]);

  const onActivate = useCallback(() => {
    const ctrl = controllerRef.current;
    if (ctrl) {
      const evt = ctrl.activate();
      setCurrentEvent(evt);
    } else if (config.method === "touch") {
      // For touch, activation is handled by the parent; emit a generic event.
      const item = items.find((i) => i.id === highlightedId);
      if (item) {
        const evt: AACEvent = {
          method: "touch",
          targetId: item.id,
          timestamp: Date.now(),
        };
        setCurrentEvent(evt);
      }
    }
  }, [config.method, highlightedId, items]);

  return { highlightedId, onActivate, currentEvent };
}
