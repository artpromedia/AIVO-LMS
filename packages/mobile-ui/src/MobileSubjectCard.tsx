import React from "react";
import { View, Text, StyleSheet, Pressable, type AccessibilityRole } from "react-native";
import { theme } from "./theme";

/**
 * Mobile/MobileSubjectCard
 *
 * Sprint 18: the mobile mirror of @aivo/ui/learner-home/SubjectCard.
 * Big touch target, soft shadow, mastery progress bar (RN doesn't
 * paint a circular ring without an SVG dep, so we render a horizontal
 * progress strip instead — same data, tactile feel).
 */
export interface MobileSubjectCardProps {
  name: string;
  eyebrow?: string;
  masteryLabel: string;
  masteryPct: number;
  icon?: React.ReactNode;
  /** Hex/var accent for the bar fill. */
  accent?: string;
  nextAction?: string;
  teacherAssigned?: number;
  support?: string;
  locked?: boolean;
  onPress?: () => void;
}

export function MobileSubjectCard({
  name,
  eyebrow,
  masteryLabel,
  masteryPct,
  icon,
  accent = theme.colors.primary,
  nextAction,
  teacherAssigned,
  support,
  locked,
  onPress,
}: MobileSubjectCardProps) {
  const clamped = Math.max(0, Math.min(100, masteryPct));
  return (
    <Pressable
      accessibilityRole={"button" as AccessibilityRole}
      accessibilityState={{ disabled: locked }}
      onPress={locked ? undefined : onPress}
      style={({ pressed }) => [
        styles.card,
        locked && { opacity: 0.55 },
        pressed && !locked && { transform: [{ translateY: 1 }] },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: `${accent}1A` }]}>
          {typeof icon === "string" ? (
            <Text style={[styles.iconText, { color: accent }]}>{icon}</Text>
          ) : (
            icon
          )}
        </View>
        <Text style={styles.masteryPct}>{Math.round(clamped)}%</Text>
      </View>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.masteryLabel}>{masteryLabel}</Text>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${Math.max(6, clamped)}%`, backgroundColor: accent },
          ]}
        />
      </View>
      {nextAction ? (
        <View style={styles.nextRow}>
          <Text style={styles.nextLabel}>NEXT</Text>
          <Text style={styles.nextValue} numberOfLines={1}>
            {nextAction}
          </Text>
        </View>
      ) : null}
      <View style={styles.chipRow}>
        {support ? (
          <View style={[styles.chip, { backgroundColor: theme.colors.surfaceSoft }]}>
            <Text style={styles.chipText}>{support}</Text>
          </View>
        ) : null}
        {typeof teacherAssigned === "number" && teacherAssigned > 0 ? (
          <View style={[styles.chip, { backgroundColor: `${theme.colors.warning}1A` }]}>
            <Text style={[styles.chipText, { color: theme.colors.warning }]}>
              {teacherAssigned} from teacher
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.md,
    minHeight: 140,
    ...theme.shadows.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: { fontSize: 22, fontWeight: "700" },
  masteryPct: {
    fontSize: 22,
    fontWeight: "700",
    color: theme.colors.text,
    fontVariant: ["tabular-nums"],
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: theme.colors.textSecondary,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  name: { fontSize: 17, fontWeight: "700", color: theme.colors.text },
  masteryLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  progressTrack: {
    marginTop: theme.spacing.sm,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.border,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 3 },
  nextRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  nextLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: theme.colors.textSecondary,
  },
  nextValue: { fontSize: 13, color: theme.colors.text, flex: 1 },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: theme.spacing.sm,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
  },
  chipText: { fontSize: 11, fontWeight: "700", color: theme.colors.text },
});
