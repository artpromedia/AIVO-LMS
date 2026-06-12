/**
 * Sprint 13 — style sheet + config readers shared by every surface module,
 * moved verbatim from MobileSurfaceRenderer.tsx.
 */
import { StyleSheet } from "react-native";
import type { TierThemeMobile } from "@aivo/mobile-ui";

export function readNumber(
  config: Record<string, unknown> | undefined,
  key: string,
  fallback: number,
): number {
  const v = config?.[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return fallback;
}

export function readString(
  config: Record<string, unknown> | undefined,
  key: string,
  fallback: string,
): string {
  const v = config?.[key];
  return typeof v === "string" ? v : fallback;
}

export function createSurfaceStyles(theme: TierThemeMobile) {
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
