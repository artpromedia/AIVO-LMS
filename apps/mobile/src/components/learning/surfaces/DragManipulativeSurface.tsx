/**
 * Sprint 13 — accessible tap-to-place manipulative (Sprint 5 surface, moved
 * verbatim): tap a token, then tap a target to drop it; tap a placed token
 * to return it to the tray.
 */
import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { createSurfaceStyles } from "./shared";
import type { SurfaceProps } from "./types";

interface DragItem {
  id: string;
  label: string;
  emoji?: string;
}
interface DragTarget {
  id: string;
  label: string;
}

export function DragManipulativeSurface({ theme, disabled, cfg, onSubmit }: SurfaceProps) {
  const styles = useMemo(() => createSurfaceStyles(theme), [theme]);
  const items = (Array.isArray(cfg?.items) ? (cfg!.items as DragItem[]) : []).filter(
    (i) => i && typeof i.id === "string",
  );
  const targets = (Array.isArray(cfg?.targets) ? (cfg!.targets as DragTarget[]) : []).filter(
    (t) => t && typeof t.id === "string",
  );
  const [placement, setPlacement] = useState<Record<string, string>>({});
  const [held, setHeld] = useState<string | null>(null);

  const tray = items.filter((it) => !(it.id in placement));
  const chip = (label: string, active: boolean, onPress: () => void, key: string) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      onPress={disabled ? undefined : onPress}
      style={[
        {
          borderWidth: 2,
          borderColor: active ? theme.colors.primary : theme.colors.border,
          backgroundColor: active ? theme.colors.primarySoft : theme.colors.surface,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 10,
        },
      ]}
    >
      <Text style={{ color: theme.colors.text, fontWeight: "600", fontSize: 16 }}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {tray.map((it) =>
          chip(
            `${it.emoji ?? ""} ${it.label}`.trim(),
            held === it.id,
            () => setHeld(held === it.id ? null : it.id),
            it.id,
          ),
        )}
      </View>
      <View style={{ gap: 10 }}>
        {targets.map((t) => {
          const here = items.filter((it) => placement[it.id] === t.id);
          return (
            <Pressable
              key={t.id}
              accessibilityRole="button"
              accessibilityLabel={`drop into ${t.label}`}
              onPress={() => {
                if (disabled || !held) return;
                setPlacement((p) => ({ ...p, [held]: t.id }));
                setHeld(null);
              }}
              style={{
                borderWidth: 2,
                borderStyle: "dashed",
                borderColor: held ? theme.colors.primary : theme.colors.border,
                borderRadius: 12,
                padding: 12,
                gap: 8,
              }}
            >
              <Text style={{ color: theme.colors.textSoft, fontWeight: "600" }}>{t.label}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {here.map((it) =>
                  chip(
                    `${it.emoji ?? ""} ${it.label}`.trim(),
                    false,
                    () =>
                      setPlacement((p) => {
                        const next = { ...p };
                        delete next[it.id];
                        return next;
                      }),
                    it.id,
                  ),
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="submit placement"
        disabled={disabled || Object.keys(placement).length < items.length}
        onPress={() => onSubmit({ kind: "drag_manipulative", placement })}
        style={[
          styles.submit,
          (disabled || Object.keys(placement).length < items.length) && styles.submitDisabled,
        ]}
      >
        <Text style={styles.submitText}>I&apos;m done</Text>
      </Pressable>
    </View>
  );
}
