import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { router, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { useAuth } from "@/hooks/useAuth";
import { useLearners } from "@/hooks/useLearners";

/**
 * (parent)/home-v2 — REDESIGNED parent home (mobile parity).
 *
 * Mirrors apps/web-v2/app/parent/home-v2 with mobile primitives.
 * Non-destructive: the legacy (parent)/index dashboard is left in
 * place; this lives at a separate route. Flip the tab when QA
 * passes.
 *
 * Sprint-4 verbatim acceptance:
 *   "Parent home feels premium and calm. All cards have real
 *    destinations."
 *   Greeting: "Hi, [name]. [Child] is ready for today's learning."
 */

interface SectionRowProps {
  iconName: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}

function SectionRow({ iconName, title, subtitle, onPress }: SectionRowProps) {
  const palette = useSensoryPalette();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.row, pressed && { opacity: 0.85 }]}>
      <View style={[s.rowIcon, { backgroundColor: palette.primary + "1a" }]}>
        <Ionicons name={iconName} size={18} color={palette.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle}>{title}</Text>
        <Text style={s.rowSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
    </Pressable>
  );
}

export default function ParentHomeV2() {
  const insets = useSafeAreaInsets();
  const palette = useSensoryPalette();
  // Sprint 7.1: pull real names from auth + learner profile API instead
  // of hardcoded placeholders. Falls back to neutral copy while the
  // queries are loading so the hero card never flashes "undefined".
  const { user } = useAuth();
  const learnersQuery = useLearners();
  const parentFirstName = (user?.name ?? "").trim().split(/\s+/)[0] || "there";
  const activeLearner = learnersQuery.data?.[0];
  const learnerFirstName = activeLearner?.firstName ?? "Your learner";

  // Route into a learner-scoped surface using the real active learner.
  // Falls back to the learners list when none is loaded yet so the cards
  // never navigate to a phantom id.
  const openLearner = (section: "session" | "progress" | "milestones" | "iep" | "team") => {
    if (!activeLearner?.id) {
      router.push("/(parent)/learners" as Href);
      return;
    }
    router.push(`/(parent)/${section}/${activeLearner.id}` as Href);
  };

  return (
    <ScrollView
      style={[s.canvas, { paddingTop: insets.top }]}
      contentContainerStyle={[s.content, { paddingBottom: insets.bottom + spacing.xl }]}
    >
      <View
        style={[
          s.hero,
          { backgroundColor: palette.primary + "12", borderColor: palette.primary + "33" },
        ]}
      >
        <Text style={s.heroGreeting}>Hi, {parentFirstName}.</Text>
        <Text style={s.heroSubhead}>{learnerFirstName} is ready for today&apos;s learning.</Text>
        <Text style={s.heroBody}>
          Calm, personalized, and waiting for one quick check-in from you.
        </Text>
        <View style={s.heroActions}>
          <Pressable accessibilityRole="button"
            onPress={() => openLearner("session")}
            style={[s.btnPrimary, { backgroundColor: palette.primary }]}
          >
            <Ionicons name="play" size={16} color="#fff" />
            <Text style={s.btnPrimaryText}>Start with {learnerFirstName}</Text>
          </Pressable>
          <Pressable accessibilityRole="button"
            onPress={() => router.push("/(parent)/onboard" as Href)}
            style={s.btnSecondary}
          >
            <Ionicons name="person-add" size={16} color={colors.text} />
            <Text style={s.btnSecondaryText}>Add learner</Text>
          </Pressable>
        </View>
      </View>

      <Text style={s.sectionLabel}>Details</Text>
      <View style={s.list}>
        <SectionRow
          iconName="sparkles"
          title="Learning readiness"
          subtitle="Today's plan, pacing, and sensory mode."
          onPress={() => openLearner("session")}
        />
        <SectionRow
          iconName="checkmark-circle"
          title="Consent checklist"
          subtitle="Review approvals and optional settings."
          onPress={() => router.push("/(parent)/settings" as Href)}
        />
        <SectionRow
          iconName="document-text"
          title="IEP / support upload"
          subtitle="Upload supports and accommodations."
          onPress={() => openLearner("iep")}
        />
        <SectionRow
          iconName="notifications"
          title="Notifications"
          subtitle="Review recent parent updates."
          onPress={() => router.push("/(parent)/inbox" as Href)}
        />
        <SectionRow
          iconName="card"
          title="Billing"
          subtitle="Review your family plan and renewal details."
          onPress={() => router.push("/(parent)/billing" as Href)}
        />
        <SectionRow
          iconName="school"
          title="School connection"
          subtitle="Not linked. Tap to connect a school."
          onPress={() => openLearner("team")}
        />
      </View>

      <Text style={s.footer}>Legacy home is still available via the tab bar.</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  hero: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  heroGreeting: { fontFamily: fontFamilies.displayBold, fontSize: 26, color: colors.text },
  heroSubhead: {
    fontFamily: fontFamilies.displaySemiBold,
    fontSize: 18,
    color: colors.textSecondary,
  },
  heroBody: {
    fontFamily: fontFamilies.bodyRegular,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  heroActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" },
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  btnPrimaryText: { color: "#fff", fontFamily: fontFamilies.bodyBold, fontSize: 14 },
  btnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnSecondaryText: { color: colors.text, fontFamily: fontFamilies.bodySemiBold, fontSize: 14 },
  sectionLabel: {
    fontFamily: fontFamilies.bodySemiBold,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  list: { gap: spacing.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontFamily: fontFamilies.bodyBold, fontSize: 14, color: colors.text },
  rowSubtitle: {
    fontFamily: fontFamilies.bodyRegular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  footer: {
    textAlign: "center",
    fontFamily: fontFamilies.bodyRegular,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
});
