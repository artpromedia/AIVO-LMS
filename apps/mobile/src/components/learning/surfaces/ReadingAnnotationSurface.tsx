/**
 * Sprint 13 — reading comprehension annotation (Sprint 4 surface, moved
 * verbatim). The learner taps the words/phrases that answer the question to
 * cite their evidence (mirrors the web ReadingAnnotationSurface). Tappable
 * spans highlight on selection.
 */
import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { createSurfaceStyles, readString } from "./shared";
import type { SurfaceProps } from "./types";

export interface ReadingSpan {
  id: string;
  text: string;
  selectable?: boolean;
  breakAfter?: boolean;
}

/** Exported for unit tests: tolerant span extraction from authored config. */
export function readSpans(cfg: Record<string, unknown> | undefined): ReadingSpan[] {
  const raw = cfg?.passage;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is ReadingSpan => !!s && typeof (s as ReadingSpan).id === "string")
    .map((s) => ({
      id: s.id,
      text: String(s.text ?? ""),
      selectable: s.selectable,
      breakAfter: s.breakAfter,
    }));
}

export function ReadingAnnotationSurface({ theme, disabled, cfg, onSubmit }: SurfaceProps) {
  const styles = useMemo(() => createSurfaceStyles(theme), [theme]);
  const spans = useMemo(() => readSpans(cfg), [cfg]);
  const question = readString(cfg, "question", "");
  const tool = readString(cfg, "tool", "highlight");
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) => {
    if (disabled) return;
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  return (
    <View style={{ gap: 12 }}>
      {question ? <Text style={styles.body}>{question}</Text> : null}
      <Text style={{ fontSize: 18, lineHeight: 28, color: theme.colors.text }}>
        {spans.map((span) => {
          const selectable = span.selectable !== false;
          const isSel = selected.includes(span.id);
          return (
            <Text
              key={span.id}
              onPress={selectable ? () => toggle(span.id) : undefined}
              accessibilityRole={selectable ? "button" : undefined}
              accessibilityState={selectable ? { selected: isSel } : undefined}
              style={
                isSel
                  ? { backgroundColor: theme.colors.primary + "33", color: theme.colors.text }
                  : undefined
              }
            >
              {span.text}
              {span.breakAfter ? "\n" : " "}
            </Text>
          );
        })}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="submit annotation"
        onPress={() => {
          if (disabled) return;
          onSubmit({ kind: "reading_annotation", selectedSpanIds: selected, tool });
        }}
        disabled={disabled || selected.length === 0}
        style={[styles.submit, (disabled || selected.length === 0) && styles.submitDisabled]}
      >
        <Text style={styles.submitText}>
          {selected.length === 0 ? "Tap your evidence" : "I'm done"}
        </Text>
      </Pressable>
    </View>
  );
}
