import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useLearner } from "@/hooks/useLearners";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { useColumns } from "@aivo/mobile-ui";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { Card } from "@/components/ui";
import { WhatsWorkingCard } from "@/components/parent/WhatsWorkingCard";
import { spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

interface Tile {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: (id: string) => string;
}

/**
 * Parent learner profile hub (MOB-PAR-003) — mirror of web's
 * `/parent/learners/[learnerId]`. A quick-access header plus an
 * exploration grid that fans out to every per-learner surface.
 */
export default function LearnerHubScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { learnerId } = useLocalSearchParams<{ learnerId: string }>();
  const id = learnerId ?? "";
  const { data: learner } = useLearner(id);
  const columns = useColumns({ compact: 2, medium: 3, expanded: 4 });

  const TILES: Tile[] = [
    {
      key: "progress",
      icon: "trending-up",
      label: t("parentHub.progress", "Progress"),
      route: (i) => `/(parent)/progress/${i}`,
    },
    {
      key: "gradebook",
      icon: "bar-chart",
      label: t("parentHub.gradebook", "Gradebook"),
      route: (i) => `/(parent)/gradebook/${i}`,
    },
    {
      key: "summary",
      icon: "document-text",
      label: t("parentHub.summary", "Summary"),
      route: (i) => `/(parent)/summary/${i}`,
    },
    {
      key: "snapshot",
      icon: "calendar",
      label: t("parentHub.snapshot", "This week"),
      route: (i) => `/(parent)/snapshot/${i}`,
    },
    {
      key: "brain",
      icon: "bulb",
      label: t("parentHub.brain", "Brain profile"),
      route: (i) => `/(parent)/brain/${i}`,
    },
    {
      key: "milestones",
      icon: "ribbon",
      label: t("parentHub.milestones", "Milestones"),
      route: (i) => `/(parent)/milestones/${i}`,
    },
    {
      key: "iep",
      icon: "clipboard",
      label: t("parentHub.iep", "IEP / Supports"),
      route: (i) => `/(parent)/iep/${i}`,
    },
    {
      key: "team",
      icon: "people",
      label: t("parentHub.team", "Care team"),
      route: (i) => `/(parent)/team/${i}`,
    },
    {
      key: "session",
      icon: "play-circle",
      label: t("parentHub.session", "Co-learn"),
      route: (i) => `/(parent)/session/${i}`,
    },
  ];

  return (
    <ResponsiveScreen maxWidth="dashboard" background={palette.bgPage}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t("common.back", "Back")}
          hitSlop={8}
          style={[
            styles.backBtn,
            { backgroundColor: palette.bgRaised, borderColor: palette.border },
          ]}
        >
          <Ionicons name="chevron-back" size={22} color={palette.ink} />
        </Pressable>
        <View style={{ width: 44 }} />
      </View>

      <Card tone="hero" style={styles.heroCard}>
        <View style={[styles.avatar, { backgroundColor: palette.accentSoft }]}>
          <Text style={[styles.initial, { color: palette.accent }]}>
            {learner?.firstName?.[0] ?? "?"}
          </Text>
        </View>
        <Text style={[styles.name, { color: palette.ink }]}>
          {learner ? `${learner.firstName} ${learner.lastName}` : t("common.loading", "Loading…")}
        </Text>
        {learner ? (
          <Text style={[styles.meta, { color: palette.inkMuted }]}>
            {t("common.grade", {
              grade: learner.gradeLevel,
              defaultValue: `Grade ${learner.gradeLevel}`,
            })}
            {learner.functioningLevel ? ` · ${learner.functioningLevel}` : ""}
          </Text>
        ) : null}
      </Card>

      {learner ? (
        <WhatsWorkingCard learnerId={id} learnerName={`${learner.firstName} ${learner.lastName}`} />
      ) : null}

      <View style={styles.grid}>
        {TILES.map((tile) => (
          <View key={tile.key} style={[styles.cell, { flexBasis: `${100 / columns}%` }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tile.label}
              onPress={() => router.push(tile.route(id) as Href)}
              style={[
                styles.tile,
                { backgroundColor: palette.bgRaised, borderColor: palette.border },
              ]}
            >
              <View style={[styles.tileIcon, { backgroundColor: palette.bgPage }]}>
                <Ionicons name={tile.icon} size={22} color={palette.primary} />
              </View>
              <Text style={[styles.tileLabel, { color: palette.ink }]}>{tile.label}</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCard: { alignItems: "center", gap: 6, marginBottom: spacing.md },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { fontSize: 26, fontFamily: fontFamilies.displayBold },
  name: { fontSize: 20, fontFamily: fontFamilies.displayBold },
  meta: { fontSize: 13, fontFamily: fontFamilies.bodyRegular },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -spacing.xs },
  cell: { padding: spacing.xs },
  tile: {
    alignItems: "center",
    gap: 8,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  tileLabel: { fontSize: 12, fontFamily: fontFamilies.bodyBold, textAlign: "center" },
});
