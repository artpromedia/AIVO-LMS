/**
 * Sprint 6 (learner roadmap): mobile surface renderer.
 *
 * Replaces the Sprint-02 placeholder with interactive surfaces for the
 * `LearnerSurfaceKind`s the mobile app actually receives today:
 *  - `text_response` — free-text answer with a "submit" affordance.
 *  - `number_line` — tap a tick to mark the value the learner picks.
 *  - `fraction_bar` — tap segments to shade them; submits the fraction.
 *  - `scratchpad` — reuses the existing `ScratchPad` and submits the
 *    completed stroke set.
 *  - `geometry_workspace` / `chart` — fall back to a scratchpad work
 *    area so the learner can still draw + advance. These get a "tap to
 *    draw" hint instead of the old "not yet supported" copy.
 *
 * The `onSubmit` payload is a discriminated `SurfaceCommand` so the
 * runtime / learning-svc can later evolve a strict schema. Today the
 * runtime ignores the contents (the original placeholder passed `{}`),
 * so this is forward-compatible: when the server starts caring, the
 * client already speaks a sensible shape.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { TierThemeMobile } from "@aivo/mobile-ui";
import type { SurfaceBeat } from "@/src/types/stage";
import type { LearnerSurfaceKind } from "@/src/types/learnerSurface";
import { emitSurfaceTelemetry } from "@/lib/surface-telemetry";
import { ScratchPad, type ScratchStroke } from "./ScratchPad";

/**
 * Mobile surface kinds that have a dedicated interactive renderer. Everything
 * else (geometry_workspace, chart, or an unknown kind) is a fallback: it still
 * lets the learner respond via the ink workspace, but is reported to telemetry
 * as `unsupported_surface` and labelled as a simplified version (Sprint 3).
 */
const FULL_MOBILE_KINDS = new Set<LearnerSurfaceKind>([
  "text_response",
  "number_line",
  "fraction_bar",
  "coding_sandbox",
  "art_canvas",
  "scratchpad",
]);

export type SurfaceTutorKey =
  | "nova"
  | "sage"
  | "spark"
  | "chrono"
  | "pixel"
  | "echo"
  | "harmony"
  | "atlas"
  | "cadence"
  | "vigor"
  | "lingua"
  | "forge"
  | "compass"
  | "muse";

/**
 * Mirror of the web `requiredTutorForSurface` map. Kept in this file
 * so the mobile bundle doesn't have to import the web learner-surfaces
 * package (which depends on `react-dom`). Keep these two in sync.
 */
const REQUIRED_TUTOR: Partial<Record<LearnerSurfaceKind, SurfaceTutorKey>> = {
  coding_sandbox: "pixel",
  // Sprint 1 fix (kept in sync with the web entitlement map): the art canvas
  // belongs to the art tutor (muse), not the music tutor (cadence).
  art_canvas: "muse",
};

export type SurfaceCommand =
  | { kind: "text_response"; text: string }
  | { kind: "number_line"; value: number }
  | { kind: "fraction_bar"; numerator: number; denominator: number }
  | { kind: "scratchpad"; strokes: ScratchStroke[] }
  | { kind: "geometry_workspace"; strokes: ScratchStroke[] }
  | { kind: "chart"; strokes: ScratchStroke[] }
  | { kind: "coding_sandbox"; code: string; language: string }
  | { kind: "art_canvas"; strokes: ScratchStroke[]; color: string }
  | { kind: "noop"; surfaceKind: LearnerSurfaceKind };

interface Props {
  theme: TierThemeMobile;
  beat: SurfaceBeat;
  disabled?: boolean;
  onSubmit: (commands: SurfaceCommand) => void;
  /**
   * Sprint 8/9 — optional set of tutor keys the learner is entitled
   * to. When supplied, premium surfaces (`coding_sandbox`,
   * `art_canvas`) render a locked panel rather than the interactive
   * UI if the required add-on is missing. Omit to default-allow
   * during entitlement load (the server still gates session start).
   */
  entitledTutors?: ReadonlySet<SurfaceTutorKey> | readonly SurfaceTutorKey[];
}

function readNumber(config: Record<string, unknown> | undefined, key: string, fallback: number) {
  const v = config?.[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return fallback;
}

function readString(
  config: Record<string, unknown> | undefined,
  key: string,
  fallback: string,
): string {
  const v = config?.[key];
  return typeof v === "string" ? v : fallback;
}

function isEntitled(
  kind: LearnerSurfaceKind,
  entitled?: ReadonlySet<SurfaceTutorKey> | readonly SurfaceTutorKey[],
): boolean {
  const required = REQUIRED_TUTOR[kind];
  if (!required) return true;
  if (entitled === undefined) return true;
  if (Array.isArray(entitled)) return entitled.includes(required);
  return (entitled as ReadonlySet<SurfaceTutorKey>).has(required);
}

export function MobileSurfaceRenderer({ theme, beat, disabled, onSubmit, entitledTutors }: Props) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const kind = beat.surface.kind;
  const cfg = beat.surface.config;

  const title = kind.replace(/_/g, " ");
  const isFallback = !FULL_MOBILE_KINDS.has(kind);

  // Sprint 3: report which surface the learner actually got. A fallback kind
  // (no dedicated mobile renderer) emits `unsupported_surface` so the gap is
  // visible in telemetry instead of being a silent scratchpad downgrade.
  useEffect(() => {
    emitSurfaceTelemetry(kind, isFallback ? "unsupported_surface" : "surface_started", {
      platform: "mobile",
      ...(isFallback ? { reason: "no_dedicated_mobile_renderer" } : {}),
    });
  }, [kind, isFallback]);

  if (!isEntitled(kind, entitledTutors)) {
    const required = REQUIRED_TUTOR[kind];
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>
          {`This activity needs the ${required ?? "premium"} tutor add-on.`}
        </Text>
        <Text style={styles.note}>Ask a grown-up to unlock it from the billing screen.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {beat.text ? <Text style={styles.body}>{beat.text}</Text> : null}

      {kind === "text_response" ? (
        <TextResponseSurface theme={theme} disabled={disabled} onSubmit={onSubmit} />
      ) : kind === "number_line" ? (
        <NumberLineSurface
          theme={theme}
          disabled={disabled}
          min={readNumber(cfg, "min", 0)}
          max={readNumber(cfg, "max", 10)}
          step={Math.max(1, readNumber(cfg, "step", 1))}
          onSubmit={onSubmit}
        />
      ) : kind === "fraction_bar" ? (
        <FractionBarSurface
          theme={theme}
          disabled={disabled}
          denominator={Math.max(1, Math.min(12, readNumber(cfg, "denominator", 4)))}
          onSubmit={onSubmit}
        />
      ) : kind === "coding_sandbox" ? (
        <CodingSandboxSurface
          theme={theme}
          disabled={disabled}
          language={readString(cfg, "language", "python")}
          starterCode={readString(cfg, "starterCode", "")}
          onSubmit={onSubmit}
        />
      ) : kind === "art_canvas" ? (
        <ArtCanvasSurface theme={theme} disabled={disabled} onSubmit={onSubmit} />
      ) : (
        // scratchpad (full) + fallback kinds (geometry_workspace, chart,
        // unknown) share the ink workspace. Fallback kinds show a label so the
        // simplified experience is explicit rather than a silent downgrade.
        <>
          {isFallback ? (
            <Text style={styles.note}>
              This is a simplified version on your device — open it in the web app for the full
              activity.
            </Text>
          ) : null}
          <ScratchSurface
            theme={theme}
            disabled={disabled}
            surfaceKind={kind}
            onSubmit={onSubmit}
          />
        </>
      )}
    </View>
  );
}

/* -------------------------------------------------------------------- */
/* text_response                                                        */
/* -------------------------------------------------------------------- */

function TextResponseSurface({
  theme,
  disabled,
  onSubmit,
}: {
  theme: TierThemeMobile;
  disabled?: boolean;
  onSubmit: (c: SurfaceCommand) => void;
}) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [text, setText] = useState("");
  const canSubmit = text.trim().length > 0 && !disabled;
  return (
    <View style={{ gap: 12 }}>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        editable={!disabled}
        placeholder="Type your answer…"
        placeholderTextColor={theme.colors.text + "80"}
        style={styles.textInput}
        accessibilityLabel="Your answer"
      />
      <Pressable
        accessibilityRole="button"
        onPress={() => onSubmit({ kind: "text_response", text: text.trim() })}
        disabled={!canSubmit}
        style={[styles.submit, !canSubmit && styles.submitDisabled]}
      >
        <Text style={styles.submitText}>Submit answer</Text>
      </Pressable>
    </View>
  );
}

/* -------------------------------------------------------------------- */
/* number_line                                                          */
/* -------------------------------------------------------------------- */

function NumberLineSurface({
  theme,
  disabled,
  min,
  max,
  step,
  onSubmit,
}: {
  theme: TierThemeMobile;
  disabled?: boolean;
  min: number;
  max: number;
  step: number;
  onSubmit: (c: SurfaceCommand) => void;
}) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [selected, setSelected] = useState<number | null>(null);
  // Build the visible tick list; clamp to avoid runaway arrays from
  // hostile config (e.g. min=0, max=10000, step=1).
  const ticks = useMemo(() => {
    const out: number[] = [];
    if (max <= min) return [min];
    const safeStep = step > 0 ? step : 1;
    const count = Math.min(50, Math.floor((max - min) / safeStep) + 1);
    for (let i = 0; i < count; i++) out.push(min + i * safeStep);
    return out;
  }, [min, max, step]);

  return (
    <View style={{ gap: 12 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {ticks.map((n) => {
          const isSelected = selected === n;
          return (
            <Pressable
              key={n}
              onPress={() => !disabled && setSelected(n)}
              accessibilityRole="button"
              accessibilityLabel={`Pick ${n}`}
              accessibilityState={{ selected: isSelected, disabled: !!disabled }}
              style={[styles.tick, isSelected && styles.tickSelected]}
            >
              <Text style={[styles.tickText, isSelected && styles.tickTextSelected]}>{n}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        onPress={() => selected !== null && onSubmit({ kind: "number_line", value: selected })}
        disabled={selected === null || disabled}
        style={[styles.submit, (selected === null || disabled) && styles.submitDisabled]}
      >
        <Text style={styles.submitText}>
          {selected === null ? "Tap a number" : `Submit ${selected}`}
        </Text>
      </Pressable>
    </View>
  );
}

/* -------------------------------------------------------------------- */
/* fraction_bar                                                         */
/* -------------------------------------------------------------------- */

function FractionBarSurface({
  theme,
  disabled,
  denominator,
  onSubmit,
}: {
  theme: TierThemeMobile;
  disabled?: boolean;
  denominator: number;
  onSubmit: (c: SurfaceCommand) => void;
}) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [shaded, setShaded] = useState<Set<number>>(() => new Set());
  const toggle = useCallback(
    (i: number) => {
      if (disabled) return;
      setShaded((prev) => {
        const next = new Set(prev);
        if (next.has(i)) next.delete(i);
        else next.add(i);
        return next;
      });
    },
    [disabled],
  );
  const numerator = shaded.size;
  const canSubmit = numerator > 0 && !disabled;
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.fractionBar}>
        {Array.from({ length: denominator }).map((_, i) => {
          const isShaded = shaded.has(i);
          return (
            <Pressable
              key={i}
              onPress={() => toggle(i)}
              accessibilityRole="button"
              accessibilityLabel={`Segment ${i + 1} of ${denominator}`}
              accessibilityState={{ selected: isShaded, disabled: !!disabled }}
              style={[
                styles.fractionSegment,
                isShaded && styles.fractionSegmentShaded,
                i === 0 && styles.fractionSegmentFirst,
                i === denominator - 1 && styles.fractionSegmentLast,
              ]}
            />
          );
        })}
      </View>
      <Text style={styles.fractionLabel}>
        {numerator} / {denominator}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => onSubmit({ kind: "fraction_bar", numerator, denominator })}
        disabled={!canSubmit}
        style={[styles.submit, !canSubmit && styles.submitDisabled]}
      >
        <Text style={styles.submitText}>
          {numerator === 0 ? "Shade some pieces" : `Submit ${numerator}/${denominator}`}
        </Text>
      </Pressable>
    </View>
  );
}

/* -------------------------------------------------------------------- */
/* coding_sandbox (Sprint 8)                                            */
/* -------------------------------------------------------------------- */

function CodingSandboxSurface({
  theme,
  disabled,
  language,
  starterCode,
  onSubmit,
}: {
  theme: TierThemeMobile;
  disabled?: boolean;
  language: string;
  starterCode: string;
  onSubmit: (c: SurfaceCommand) => void;
}) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [code, setCode] = useState<string>(starterCode);
  const canSubmit = code.trim().length > 0 && !disabled;
  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.codeLanguageBadge}>{language}</Text>
      <TextInput
        value={code}
        onChangeText={setCode}
        multiline
        editable={!disabled}
        autoCorrect={false}
        autoCapitalize="none"
        spellCheck={false}
        placeholder="// write your code here"
        placeholderTextColor={theme.colors.text + "80"}
        style={styles.codeInput}
        accessibilityLabel={`code editor (${language})`}
      />
      <Pressable
        accessibilityRole="button"
        onPress={() => onSubmit({ kind: "coding_sandbox", code, language })}
        disabled={!canSubmit}
        style={[styles.submit, !canSubmit && styles.submitDisabled]}
      >
        <Text style={styles.submitText}>Submit code</Text>
      </Pressable>
    </View>
  );
}

/* -------------------------------------------------------------------- */
/* art_canvas (Sprint 9)                                                */
/* -------------------------------------------------------------------- */

function ArtCanvasSurface({
  theme,
  disabled,
  onSubmit,
}: {
  theme: TierThemeMobile;
  disabled?: boolean;
  onSubmit: (c: SurfaceCommand) => void;
}) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [strokes, setStrokes] = useState<ScratchStroke[]>([]);
  // The selected color is tracked for telemetry parity with the web
  // ArtCanvasSurface; ScratchPad already exposes its own swatch picker.
  const selectedColor = strokes.length > 0 ? strokes[strokes.length - 1].color : "#1B1B1B";
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.scratchHolder}>
        <ScratchPad onChange={setStrokes} compactToolbar />
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => onSubmit({ kind: "art_canvas", strokes, color: selectedColor })}
        disabled={disabled || strokes.length === 0}
        style={[styles.submit, (disabled || strokes.length === 0) && styles.submitDisabled]}
      >
        <Text style={styles.submitText}>
          {strokes.length === 0 ? "Draw something first" : "Submit artwork"}
        </Text>
      </Pressable>
    </View>
  );
}

/* -------------------------------------------------------------------- */
/* scratchpad / geometry_workspace / chart                              */
/* -------------------------------------------------------------------- */

function ScratchSurface({
  theme,
  disabled,
  surfaceKind,
  onSubmit,
}: {
  theme: TierThemeMobile;
  disabled?: boolean;
  surfaceKind: LearnerSurfaceKind;
  onSubmit: (c: SurfaceCommand) => void;
}) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [strokes, setStrokes] = useState<ScratchStroke[]>([]);
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.scratchHolder}>
        <ScratchPad
          gridPaper={surfaceKind === "geometry_workspace" || surfaceKind === "chart"}
          onChange={setStrokes}
          compactToolbar
        />
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          if (disabled) return;
          if (surfaceKind === "geometry_workspace") {
            onSubmit({ kind: "geometry_workspace", strokes });
          } else if (surfaceKind === "chart") {
            onSubmit({ kind: "chart", strokes });
          } else if (surfaceKind === "scratchpad") {
            onSubmit({ kind: "scratchpad", strokes });
          } else {
            onSubmit({ kind: "noop", surfaceKind });
          }
        }}
        disabled={disabled}
        style={[styles.submit, disabled && styles.submitDisabled]}
      >
        <Text style={styles.submitText}>I&apos;m done</Text>
      </Pressable>
    </View>
  );
}

function createStyles(theme: TierThemeMobile) {
  return StyleSheet.create({
    wrap: { padding: 16, gap: 12 },
    title: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: "700",
      textTransform: "capitalize",
    },
    body: { color: theme.colors.text, fontSize: 18 },
    note: { color: theme.colors.text, opacity: 0.7, fontStyle: "italic" },
    submit: {
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
      marginTop: 4,
    },
    submitDisabled: { opacity: 0.4 },
    submitText: { color: theme.colors.surface, fontSize: 18, fontWeight: "700" },
    textInput: {
      minHeight: 96,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.text + "33",
      backgroundColor: theme.colors.surface,
      padding: 12,
      color: theme.colors.text,
      fontSize: 16,
      textAlignVertical: "top",
    },
    codeInput: {
      minHeight: 200,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.text + "33",
      backgroundColor: theme.colors.surface,
      padding: 12,
      color: theme.colors.text,
      fontSize: 14,
      fontFamily: "Courier",
      textAlignVertical: "top",
    },
    codeLanguageBadge: {
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: theme.colors.primary + "22",
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "lowercase",
    },
    tick: {
      minWidth: 44,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.text + "33",
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    tickSelected: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    tickText: { color: theme.colors.text, fontSize: 16, fontWeight: "600" },
    tickTextSelected: { color: theme.colors.surface },
    fractionBar: {
      flexDirection: "row",
      height: 56,
      borderRadius: 12,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: theme.colors.text + "33",
    },
    fractionSegment: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      borderRightWidth: 1,
      borderRightColor: theme.colors.text + "33",
    },
    fractionSegmentFirst: {},
    fractionSegmentLast: { borderRightWidth: 0 },
    fractionSegmentShaded: { backgroundColor: theme.colors.primary },
    fractionLabel: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: "700",
      textAlign: "center",
    },
    scratchHolder: {
      height: 260,
      borderRadius: 12,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: theme.colors.text + "22",
    },
  });
}
