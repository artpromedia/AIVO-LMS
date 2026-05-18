import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors, radius, spacing } from "@/constants/colors";

export type StrokeColor = string;

export interface ScratchStroke {
  id: string;
  color: StrokeColor;
  width: number;
  d: string; // SVG path data
}

export interface ScratchPadProps {
  /** Show a faint grid background for math work. */
  gridPaper?: boolean;
  /** Initial strokes (e.g. restored from a saved session). */
  initialStrokes?: ScratchStroke[];
  /** Fires whenever the stroke set changes. */
  onChange?: (strokes: ScratchStroke[]) => void;
  /** Background colour. */
  background?: string;
  /** Show the toolbar (undo/redo/erase/color/thickness). */
  toolbar?: boolean;
  /** Compact toolbar (icons only) for narrow side panels. */
  compactToolbar?: boolean;
  style?: ViewStyle;
}

const PALETTE: StrokeColor[] = ["#111827", "#7C3AED", "#2563EB", "#16A34A", "#DC2626", "#F59E0B"];
const THICKNESS = [2, 4, 6, 10];

/**
 * Finger / stylus scratchpad. Captures touch input as SVG paths so strokes
 * can be persisted to a learning session and replayed by the tutor.
 *
 * Designed to be tablet-friendly:
 *   - large hit targets in the toolbar
 *   - grid-paper option for graphing and math layout
 *   - undo / redo / clear with stack-based state
 *   - vector output (SVG path data) for easy server persistence
 */
export function ScratchPad({
  gridPaper = false,
  initialStrokes = [],
  onChange,
  background = "#FFFFFF",
  toolbar = true,
  compactToolbar = false,
  style,
}: ScratchPadProps) {
  const [strokes, setStrokes] = useState<ScratchStroke[]>(initialStrokes);
  const [redoStack, setRedoStack] = useState<ScratchStroke[]>([]);
  const [color, setColor] = useState<StrokeColor>(PALETTE[0]);
  const [width, setWidth] = useState<number>(THICKNESS[1]);
  const [erasing, setErasing] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const currentRef = useRef<ScratchStroke | null>(null);
  const [, setTick] = useState(0); // force re-render while drawing

  const commit = useCallback(
    (next: ScratchStroke[]) => {
      setStrokes(next);
      onChange?.(next);
    },
    [onChange],
  );

  const onStart = useCallback(
    (e: GestureResponderEvent) => {
      const { locationX, locationY } = e.nativeEvent;
      const id = `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      currentRef.current = {
        id,
        color: erasing ? background : color,
        width: erasing ? width * 3 : width,
        d: `M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`,
      };
      setRedoStack([]);
      setTick((n) => n + 1);
    },
    [color, width, erasing, background],
  );

  const onMove = useCallback((e: GestureResponderEvent) => {
    const c = currentRef.current;
    if (!c) return;
    const { locationX, locationY } = e.nativeEvent;
    c.d += ` L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
    setTick((n) => n + 1);
  }, []);

  const onEnd = useCallback(() => {
    const c = currentRef.current;
    if (!c) return;
    currentRef.current = null;
    commit([...strokes, c]);
  }, [commit, strokes]);

  const undo = useCallback(() => {
    if (strokes.length === 0) return;
    const last = strokes[strokes.length - 1];
    setRedoStack((r) => [...r, last]);
    commit(strokes.slice(0, -1));
  }, [strokes, commit]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const last = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    commit([...strokes, last]);
  }, [redoStack, strokes, commit]);

  const clear = useCallback(() => {
    if (strokes.length === 0) return;
    setRedoStack([]);
    commit([]);
  }, [commit, strokes.length]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setSize({ w, h });
  }, []);

  const live = currentRef.current ? [...strokes, currentRef.current] : strokes;

  const grid = useMemo(() => {
    if (!gridPaper || size.w === 0) return null;
    const step = 24;
    const lines: React.ReactNode[] = [];
    for (let x = step; x < size.w; x += step) {
      lines.push(
        <Path key={`vx-${x}`} d={`M ${x} 0 L ${x} ${size.h}`} stroke="#E5E7EB" strokeWidth={1} />,
      );
    }
    for (let y = step; y < size.h; y += step) {
      lines.push(
        <Path key={`hy-${y}`} d={`M 0 ${y} L ${size.w} ${y}`} stroke="#E5E7EB" strokeWidth={1} />,
      );
    }
    return lines;
  }, [gridPaper, size.w, size.h]);

  return (
    <View style={[styles.container, style]}>
      {toolbar ? (
        <View style={[styles.toolbar, compactToolbar && styles.toolbarCompact]}>
          <ToolButton label="↶" onPress={undo} disabled={strokes.length === 0} />
          <ToolButton label="↷" onPress={redo} disabled={redoStack.length === 0} />
          <ToolButton
            label={erasing ? "Erase ✓" : "Erase"}
            onPress={() => setErasing((e) => !e)}
            active={erasing}
          />
          {!compactToolbar ? (
            <View style={styles.palette}>
              {PALETTE.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => {
                    setColor(c);
                    setErasing(false);
                  }}
                  style={[
                    styles.swatch,
                    { backgroundColor: c },
                    color === c && !erasing && styles.swatchActive,
                  ]}
                  accessibilityLabel={`Color ${c}`}
                />
              ))}
            </View>
          ) : null}
          {!compactToolbar ? (
            <View style={styles.thicknessRow}>
              {THICKNESS.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setWidth(t)}
                  style={[styles.thickBtn, width === t && styles.thickBtnActive]}
                  accessibilityLabel={`Thickness ${t}`}
                >
                  <View
                    style={{
                      width: 18,
                      height: t,
                      backgroundColor: colors.text,
                      borderRadius: t / 2,
                    }}
                  />
                </Pressable>
              ))}
            </View>
          ) : null}
          <ToolButton label="Clear" onPress={clear} disabled={strokes.length === 0} />
        </View>
      ) : null}

      <View
        style={[styles.canvas, { backgroundColor: background }]}
        onLayout={onLayout}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={onStart}
        onResponderMove={onMove}
        onResponderRelease={onEnd}
        onResponderTerminate={onEnd}
        accessibilityLabel="Scratchpad"
      >
        {size.w > 0 ? (
          <Svg width={size.w} height={size.h}>
            {grid}
            {live.map((s) => (
              <Path
                key={s.id}
                d={s.d}
                stroke={s.color}
                strokeWidth={s.width}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ))}
          </Svg>
        ) : null}
      </View>
    </View>
  );
}

function ToolButton({
  label,
  onPress,
  disabled,
  active,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.toolBtn,
        active && styles.toolBtnActive,
        disabled && styles.toolBtnDisabled,
        pressed && !disabled && { opacity: 0.7 },
      ]}
      accessibilityRole="button"
    >
      <Text style={[styles.toolBtnText, active && { color: "#FFF" }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    padding: spacing.sm,
    flexWrap: "wrap",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  toolbarCompact: { padding: 4, gap: 4 },
  toolBtn: {
    minWidth: 40,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  toolBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  toolBtnDisabled: { opacity: 0.4 },
  toolBtnText: { fontSize: 13, fontFamily: "Nunito-Bold", color: colors.text },
  palette: { flexDirection: "row", gap: 4 },
  swatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  swatchActive: { borderColor: colors.text },
  thicknessRow: { flexDirection: "row", gap: 4 },
  thickBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  thickBtnActive: { borderColor: colors.primary, borderWidth: 2 },
  canvas: { flex: 1 },
});
