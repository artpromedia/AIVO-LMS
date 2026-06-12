/**
 * Sprint 13 — science diagram labelling (Sprint 6 surface, moved verbatim):
 * tap a label, then tap a numbered spot on the diagram to place it.
 */
import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { createSurfaceStyles, readNumber } from "./shared";
import type { SurfaceProps } from "./types";

interface DiagramTarget {
  id: string;
  x: number;
  y: number;
}
interface DiagramLabel {
  id: string;
  text: string;
}

export function ScienceDiagramSurface({ theme, disabled, cfg, onSubmit }: SurfaceProps) {
  const styles = useMemo(() => createSurfaceStyles(theme), [theme]);
  const width = readNumber(cfg, "width", 100);
  const height = readNumber(cfg, "height", 100);
  const targets = (Array.isArray(cfg?.targets) ? (cfg!.targets as DiagramTarget[]) : []).filter(
    (t) => t && typeof t.id === "string",
  );
  const labels = (Array.isArray(cfg?.labels) ? (cfg!.labels as DiagramLabel[]) : []).filter(
    (l) => l && typeof l.id === "string",
  );
  const [placement, setPlacement] = useState<Record<string, string>>({});
  const [held, setHeld] = useState<string | null>(null);
  const labelText = (id?: string) => labels.find((l) => l.id === id)?.text ?? "";
  const used = new Set(Object.values(placement));

  const BOX = 280;
  return (
    <View style={{ gap: 12 }}>
      <View style={{ width: BOX, height: (BOX * height) / (width || 1), alignSelf: "center" }}>
        {targets.map((t, i) => {
          const assigned = placement[t.id];
          return (
            <Pressable
              key={t.id}
              accessibilityRole="button"
              accessibilityLabel={
                assigned ? `target ${i + 1}, ${labelText(assigned)}` : `target ${i + 1}`
              }
              onPress={() => {
                if (disabled) return;
                if (assigned) {
                  setPlacement((p) => {
                    const next = { ...p };
                    delete next[t.id];
                    return next;
                  });
                } else if (held) {
                  setPlacement((p) => ({ ...p, [t.id]: held }));
                  setHeld(null);
                }
              }}
              style={{
                position: "absolute",
                left: `${(t.x / (width || 1)) * 100}%`,
                top: `${(t.y / (height || 1)) * 100}%`,
                transform: [{ translateX: -16 }, { translateY: -16 }],
                minWidth: 32,
                paddingHorizontal: 6,
                paddingVertical: 4,
                borderRadius: 16,
                borderWidth: 2,
                borderColor: theme.colors.primary,
                backgroundColor: theme.colors.surface,
              }}
            >
              <Text style={{ color: theme.colors.text, fontWeight: "700", fontSize: 12 }}>
                {assigned ? labelText(assigned) : i + 1}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {labels.map((l) => (
          <Pressable
            key={l.id}
            accessibilityRole="button"
            disabled={disabled || used.has(l.id)}
            onPress={() => setHeld(held === l.id ? null : l.id)}
            style={{
              borderWidth: 2,
              borderColor: held === l.id ? theme.colors.primary : theme.colors.border,
              backgroundColor: used.has(l.id) ? theme.colors.border : theme.colors.surface,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 10,
              opacity: used.has(l.id) ? 0.5 : 1,
            }}
          >
            <Text style={{ color: theme.colors.text, fontWeight: "600" }}>{l.text}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="submit diagram"
        disabled={disabled || Object.keys(placement).length < targets.length}
        onPress={() => onSubmit({ kind: "science_diagram", placement })}
        style={[
          styles.submit,
          (disabled || Object.keys(placement).length < targets.length) && styles.submitDisabled,
        ]}
      >
        <Text style={styles.submitText}>I&apos;m done</Text>
      </Pressable>
    </View>
  );
}
