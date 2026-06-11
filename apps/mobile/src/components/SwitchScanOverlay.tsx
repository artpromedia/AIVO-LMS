/**
 * SwitchScanOverlay — global switch scanning overlay for AAC learners.
 *
 * Renders when the learner's brain_state.active_accommodations includes
 * "switch_scanning". Volume-up = Switch 1 (advance scan), Volume-down = Switch 2 (activate).
 *
 * Requires @aivo/aac-bridge for SwitchScanController.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Animated, Text , AccessibilityInfo } from "react-native";
import { SwitchScanController } from "@aivo/aac-bridge";
import type { AACSessionConfig, SymbolItem } from "@aivo/aac-bridge";
import { clampScanDelayMs } from "@aivo/accessibility-contract";
import { colors } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";
import {
  useScanTargets,
  type ScanTargetRect,
} from "@/src/components/switch-scan/ScanTargetRegistry";

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
  config?: Partial<AACSessionConfig>;
}

export function SwitchScanOverlay({ active, config: configOverride }: SwitchScanOverlayProps) {
  // Live scan set from the registry — screens register their primary
  // actions (Sprint A4); the overlay no longer takes an `items` prop.
  const targets = useScanTargets();
  const items: SymbolItem[] = useMemo(
    () =>
      targets.map((t, index) => ({
        id: t.id,
        label: t.label,
        imageUrl: "",
        boardId: "scan-targets",
        position: { row: index, col: 0 },
      })),
    [targets],
  );
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [highlightRect, setHighlightRect] = useState<ScanTargetRect | null>(null);
  const controllerRef = useRef<SwitchScanController | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const config: AACSessionConfig = {
    ...DEFAULT_CONFIG,
    ...configOverride,
    scanDelayMs: clampScanDelayMs(configOverride?.scanDelayMs ?? DEFAULT_CONFIG.scanDelayMs),
  };

  const activateTarget = (targetId: string | null | undefined) => {
    if (!targetId) return;
    const target = targets.find((t) => t.id === targetId);
    target?.onActivate();
  };

  useEffect(() => {
    if (!active || items.length === 0) return;

    const ctrl = new SwitchScanController(config, items);
    controllerRef.current = ctrl;

    const unsub = ctrl.subscribe((item) => {
      setHighlightedId(item?.id ?? null);
      const target = targets.find((t) => t.id === item?.id);
      if (target) {
        AccessibilityInfo.announceForAccessibility(target.label);
        void target.measure().then((rect) => setHighlightRect(rect));
      } else {
        setHighlightRect(null);
      }
    });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pulseAnim stable; targets identity tracked via items; config via scanDelayMs
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
        activateTarget(event.targetId);
      }
    });

    return () => upSub?.remove?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- activateTarget closes over live targets
  }, [active]);

  if (!active || !highlightedId) return null;
  const highlighted = targets.find((t) => t.id === highlightedId) ?? null;

  return (
    <Modal transparent visible={active} accessible={false}>
      {/* Single-switch input surface: with one switch (or no external
          switch at all) a tap ANYWHERE activates the highlighted target.
          Volume keys (when available) remain switch 1 = advance /
          switch 2 = activate. */}
      <Pressable
        style={StyleSheet.absoluteFillObject}
        accessibilityRole="button"
        accessibilityLabel={highlighted ? highlighted.label : "Switch scan"}
        onPress={() => activateTarget(highlightedId)}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.highlightBox,
            highlightRect
              ? {
                  top: highlightRect.y - 6,
                  left: highlightRect.x - 6,
                  width: highlightRect.width + 12,
                  height: highlightRect.height + 12,
                  right: undefined,
                  bottom: undefined,
                }
              : null,
            { transform: [{ scale: pulseAnim }] },
          ]}
          accessibilityElementsHidden
        />
        {highlighted ? (
          <Text style={styles.label} accessibilityElementsHidden>
            {highlighted.label}
          </Text>
        ) : null}
      </Pressable>
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
    borderColor: colors.a11yFocusHighlight,
    borderRadius: 12,
    backgroundColor: "transparent",
    margin: 8,
  },
  label: {
    position: "absolute",
    bottom: 48,
    alignSelf: "center",
    fontFamily: fontFamilies.bodyBold,
    fontSize: 18,
    color: "#ffffff",
    backgroundColor: "rgba(15,23,42,0.85)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: "hidden",
  },
});
