/**
 * Mobile surface renderer — thin dispatcher over the Sprint 13 registry.
 *
 * Owns everything that is per-surface-agnostic, moved verbatim from the
 * 1,578-line MobileSurfaceRenderer.tsx monolith: the Sprint 04
 * accommodations (read-aloud announce, always-on captions for spoken
 * surfaces, text scaling, dyslexia-friendly body face), surface telemetry
 * (`surface_started` / `unsupported_surface`), the tutor entitlement gate
 * (locked panel), and the explicit simplified-fallback label. Per-surface
 * UI lives in ./surfaces/*; dispatch in ./surface-registry.ts.
 *
 * The `onSubmit` payload is a discriminated `SurfaceCommand` so the
 * runtime / learning-svc can later evolve a strict schema. Today the
 * runtime ignores the contents (the original placeholder passed `{}`),
 * so this is forward-compatible: when the server starts caring, the
 * client already speaks a sensible shape.
 */
import React, { useEffect, useMemo } from "react";
import { Text, View } from "react-native";
import type { TierThemeMobile } from "@aivo/mobile-ui";
import type { SurfaceBeat } from "@/src/types/stage";
import { emitSurfaceTelemetry } from "@/lib/surface-telemetry";
import { useLessonAccommodations } from "@/hooks/useLessonAccommodations";
import { usePreferences } from "@/lib/preferences";
import { useA11yStyle } from "@/lib/a11y-style";
import { resolveSurface } from "./surface-registry";
import { createSurfaceStyles } from "./surfaces/shared";
import {
  FULL_MOBILE_KINDS,
  type SurfaceCommand,
  type SurfaceTutorKey,
  isEntitled,
  requiredTutorsFor,
} from "./surfaces/types";

export type { SurfaceCommand, SurfaceTutorKey } from "./surfaces/types";

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

export function MobileSurfaceRenderer({ theme, beat, disabled, onSubmit, entitledTutors }: Props) {
  const styles = useMemo(() => createSurfaceStyles(theme), [theme]);
  const kind = beat.surface.kind;
  const cfg = beat.surface.config;

  // Honor the learner's accessibility accommodations on the lesson surface:
  // text scaling (`scale`), dyslexia-friendly body face (`bodyFontFamily`),
  // read-aloud (announce the prompt), and always-on captions for spoken
  // surfaces. These were previously inert — set in settings, applied nowhere.
  const accommodations = useLessonAccommodations();
  const { scale } = usePreferences();
  const { bodyFontFamily, announce } = useA11yStyle();

  const title = kind.replace(/_/g, " ");
  const isFallback = !FULL_MOBILE_KINDS.has(kind);
  const isSpoken = kind === "audio" || kind === "video" || kind === "voice_response";

  // Read-aloud: when enabled, announce the prompt once so a learner who relies
  // on audio hears the task without reaching for the speaker control.
  useEffect(() => {
    if (accommodations.readAloud && beat.text) announce(beat.text);
    // Announce only when the prompt or the preference changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beat.text, accommodations.readAloud]);

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
    const required = requiredTutorsFor(kind);
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>
          {`This activity needs the ${required.join(" or ") || "premium"} tutor add-on.`}
        </Text>
        <Text style={styles.note}>Ask a grown-up to unlock it from the billing screen.</Text>
      </View>
    );
  }

  const Surface = resolveSurface(kind);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { fontSize: scale(18) }]}>{title}</Text>
      {beat.text ? (
        <Text style={[styles.body, { fontSize: scale(18), fontFamily: bodyFontFamily }]}>
          {beat.text}
        </Text>
      ) : null}

      {/* Always-on captions: for spoken surfaces, keep the prompt text visible
          as a caption even when the learner is listening. */}
      {accommodations.captionsAlwaysOn && isSpoken && beat.text ? (
        <Text
          style={[styles.note, { fontSize: scale(14) }]}
          accessibilityLabel={`Caption: ${beat.text}`}
        >
          {beat.text}
        </Text>
      ) : null}

      {isFallback ? (
        <Text style={styles.note}>
          This is a simplified version on your device — open it in the web app for the full
          activity.
        </Text>
      ) : null}
      <Surface theme={theme} disabled={disabled} surfaceKind={kind} cfg={cfg} onSubmit={onSubmit} />
    </View>
  );
}
