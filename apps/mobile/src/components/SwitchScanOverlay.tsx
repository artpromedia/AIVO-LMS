/**
 * SwitchScanOverlay — global switch scanning overlay for AAC learners.
 *
 * Renders when the learner's brain_state.active_accommodations includes
 * "switch_scanning". Volume-up = Switch 1 (advance scan), Volume-down = Switch 2 (activate).
 *
 * Requires @aivo/aac-bridge for SwitchScanController.
 */
import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  StyleSheet,
  Animated,
} from "react-native";
import { SwitchScanController } from "@aivo/aac-bridge";
import type { AACSessionConfig, SymbolItem } from "@aivo/aac-bridge";

const DEFAULT_CONFIG: AACSessionConfig = {
  method: "switch_1",
  scanDelayMs: 1200,
  dwellTimeMs: 800,
  auditoryFeedback: true,
  highlightStyle: "box",
  autoStart: true,
};

export interface SwitchScanOverlayProps {
  /** Whether switch scanning is active for the current learner. */
  active: boolean;
  /** Items to scan through (pass the current stage choices as SymbolItems). */
  items: SymbolItem[];
  /** Called when the user activates the currently highlighted item. */
  onActivate?: (itemId: string) => void;
  config?: Partial<AACSessionConfig>;
}

export function SwitchScanOverlay({
  active,
  items,
  onActivate,
  config: configOverride,
}: SwitchScanOverlayProps) {
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const controllerRef = useRef<SwitchScanController | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const config: AACSessionConfig = { ...DEFAULT_CONFIG, ...configOverride };

  useEffect(() => {
    if (!active || items.length === 0) return;

    const ctrl = new SwitchScanController(config, items);
    controllerRef.current = ctrl;

    const unsub = ctrl.subscribe((item) => setHighlightedId(item?.id ?? null));
    ctrl.start();

    // Pulsing highlight animation
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 400, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    );
    pulse.start();

    return () => {
      ctrl.stop();
      unsub();
      pulse.stop();
      controllerRef.current = null;
      setHighlightedId(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pulseAnim is a stable Animated.Value ref; config object identity is intentionally tracked via scanDelayMs
  }, [active, items, config.scanDelayMs]);

  // Volume key listeners (Expo / React Native volume manager integration).
  // When react-native-volume-manager is available it emits 'VolumeUp' and
  // 'VolumeDown' events. We fall back gracefully if the module is absent.
  useEffect(() => {
    if (!active) return;

    let VolumeManager: any = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- optional native module probed at runtime
      VolumeManager = require("react-native-volume-manager");
    } catch {
      return; // Module not installed — switch scanning via volume keys unavailable.
    }

    const upSub = VolumeManager.addVolumeListener?.((e: any) => {
      if (e?.value > (e?.prevValue ?? 0.5)) {
        // Volume UP → Switch 1 → advance scan
        controllerRef.current?.advance();
      } else {
        // Volume DOWN → Switch 2 → activate
        const ctrl = controllerRef.current;
        if (!ctrl) return;
        const event = ctrl.activate();
        if (event.targetId) onActivate?.(event.targetId);
      }
    });

    return () => upSub?.remove?.();
  }, [active, onActivate]);

  if (!active || !highlightedId) return null;

  return (
    <Modal transparent visible={active} pointerEvents="none" accessible={false}>
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <Animated.View
          style={[
            styles.highlightBox,
            { transform: [{ scale: pulseAnim }] },
          ]}
          accessibilityElementsHidden
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  highlightBox: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 4,
    borderColor: "#facc15", // high-visibility yellow
    borderRadius: 12,
    backgroundColor: "transparent",
    margin: 8,
  },
});
