/**
 * Top stage bar — close button, compact progress, optional pause +
 * scratchpad toggles. Sprint 02 lifts it out of the inline
 * [sessionId].tsx to make the stage screen a thin orchestrator.
 *
 * Inclusive-warm refresh (Task #10): drops the raw close/pause Pressables in
 * favour of `HeaderUserChip` + `SensoryToggle variant="icon"` from the shared
 * UI primitives, so sensory-mode switching mid-session re-skins the Stage
 * chrome the same way it does the role dashboards.
 *
 * Phone progress refresh (Task #15): the row of beat dots used to live
 * between the user chip and the icon cluster, and on a 360 px-wide phone
 * with a 10+ beat lesson the dots either overflowed or scrunched into an
 * unreadable smear. The header now shows a compact "n / total" pill in
 * that slot and renders a thin progress bar underneath the top bar that
 * spans the full screen width, so progress stays readable regardless of
 * lesson length. Both treatments pull their colors from the active
 * sensory palette so calm / high-contrast modes still apply.
 */

import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spacing } from "@/constants/colors";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { HeaderUserChip, SensoryToggle } from "@/components/ui";
import { useTranslation } from "@/hooks/useTranslation";

interface Props {
  beatCount: number;
  currentIndex: number;
  userName: string;
  userSubtitle?: string;
  onClose: () => void;
  onPause: () => void;
  scratchpadButton?: React.ReactNode;
  paddingTop: number;
}

export function MobileSessionHeader({
  beatCount,
  currentIndex,
  userName,
  userSubtitle,
  onClose,
  onPause,
  scratchpadButton,
  paddingTop,
}: Props) {
  const palette = useSensoryPalette();
  const { t } = useTranslation();
  const styles = createStyles(paddingTop);

  const safeTotal = Math.max(beatCount, 1);
  const safeCurrent = Math.min(Math.max(currentIndex, 0), safeTotal - 1);
  const stepLabel = `${safeCurrent + 1} / ${safeTotal}`;
  // Fill = completed steps including the current beat, so a 1-beat
  // lesson shows a full bar and a fresh lesson still shows a small
  // sliver instead of an empty rail.
  const fillRatio = Math.min(1, (safeCurrent + 1) / safeTotal);
  const a11yLabel = `Step ${safeCurrent + 1} of ${safeTotal}`;

  return (
    <View>
      <View style={styles.topBar}>
        <View style={styles.leftCluster}>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t("learnerStage.header.closeSession")}
            style={({ pressed }) => [
              styles.iconBtn,
              {
                backgroundColor: palette.bgRaised,
                borderColor: palette.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Ionicons name="close" size={20} color={palette.ink} />
          </Pressable>
          <HeaderUserChip name={userName} subtitle={userSubtitle} />
        </View>

        <View
          style={[
            styles.progressPill,
            { backgroundColor: palette.bgRaised, borderColor: palette.border },
          ]}
          accessibilityRole="progressbar"
          accessibilityLabel={a11yLabel}
          accessibilityValue={{ min: 1, max: safeTotal, now: safeCurrent + 1 }}
        >
          <Text
            style={[styles.progressPillText, { color: palette.ink }]}
            numberOfLines={1}
            allowFontScaling
          >
            {stepLabel}
          </Text>
        </View>

        <View style={styles.actions}>
          {scratchpadButton}
          <SensoryToggle variant="icon" />
          <Pressable
            onPress={onPause}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t("learnerStage.header.pauseSession")}
            style={({ pressed }) => [
              styles.iconBtn,
              {
                backgroundColor: palette.bgRaised,
                borderColor: palette.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Ionicons name="pause" size={20} color={palette.ink} />
          </Pressable>
        </View>
      </View>

      <View
        style={[styles.progressTrack, { backgroundColor: palette.border }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: palette.primary,
              width: `${fillRatio * 100}%`,
            },
          ]}
        />
      </View>
    </View>
  );
}

function createStyles(paddingTop: number) {
  return StyleSheet.create({
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      paddingTop,
      paddingBottom: 8,
      gap: 12,
    },
    leftCluster: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flexShrink: 1,
    },
    progressPill: {
      minWidth: 56,
      paddingHorizontal: 12,
      height: 32,
      borderRadius: 16,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    progressPillText: {
      fontSize: 14,
      fontWeight: "600",
      fontVariant: ["tabular-nums"],
    },
    actions: { flexDirection: "row", alignItems: "center", gap: 10 },
    iconBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    progressTrack: {
      height: 3,
      width: "100%",
      overflow: "hidden",
      opacity: 0.5,
    },
    progressFill: {
      height: "100%",
      borderTopRightRadius: 2,
      borderBottomRightRadius: 2,
    },
  });
}
