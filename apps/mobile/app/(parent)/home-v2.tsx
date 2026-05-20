import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { router, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";
import { useSensoryPalette } from "@/context/SensoryModeProvider";

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

type Tone = "neutral" | "info" | "success" | "warning";

interface MetricCardProps {
  label: string;
  value: string;
  description?: string;
  iconName: keyof typeof Ionicons.glyphMap;
  tone?: Tone;
  onPress: () => void;
}

function MetricCard({ label, value, description, iconName, tone = "neutral", onPress }: MetricCardProps) {
  const palette = useSensoryPalette();
  const toneColor =
    tone === "success" ? "#16a34a"
    : tone === "warning" ? "#b45309"
    : tone === "info" ? "#0284c7"
    : palette.primary;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.metricCard, pressed && { opacity: 0.85 }]}>
      <View style={[s.metricIcon, { backgroundColor: toneColor + "22" }]}>
        <Ionicons name={iconName} size={20} color={toneColor} />
      </View>
      <Text style={s.metricLabel}>{label}</Text>
      <Text style={s.metricValue}>{value}</Text>
      {description ? <Text style={s.metricDesc}>{description}</Text> : null}
    </Pressable>
  );
}

interface SectionRowProps {
  iconName: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  badge?: string;
  onPress: () => void;
}

function SectionRow({ iconName, title, subtitle, badge, onPress }: SectionRowProps) {
  const palette = useSensoryPalette();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.row, pressed && { opacity: 0.85 }]}>
      <View style={[s.rowIcon, { backgroundColor: palette.primary + "1a" }]}>
        <Ionicons name={iconName} size={18} color={palette.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle}>{title}</Text>
        <Text style={s.rowSubtitle}>{subtitle}</Text>
      </View>
      {badge ? (
        <View style={s.rowBadge}>
          <Text style={s.rowBadgeText}>{badge}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
    </Pressable>
  );
}

export default function ParentHomeV2() {
  const insets = useSafeAreaInsets();
  const palette = useSensoryPalette();
  const parentFirstName = "Ofem";
  const learnerFirstName = "Emma";

  return (
    <ScrollView
      style={[s.canvas, { paddingTop: insets.top }]}
      contentContainerStyle={[s.content, { paddingBottom: insets.bottom + spacing.xl }]}
    >
      <View style={[s.hero, { backgroundColor: palette.primary + "12", borderColor: palette.primary + "33" }]}>
        <Text style={s.heroGreeting}>Hi, {parentFirstName}.</Text>
        <Text style={s.heroSubhead}>{learnerFirstName} is ready for today's learning.</Text>
        <Text style={s.heroBody}>Calm, personalized, and waiting for one quick check-in from you.</Text>
        <View style={s.heroActions}>
          <Pressable
            onPress={() => router.push("/(parent)/session/emma" as Href)}
            style={[s.btnPrimary, { backgroundColor: palette.primary }]}
          >
            <Ionicons name="play" size={16} color="#fff" />
            <Text style={s.btnPrimaryText}>Start with {learnerFirstName}</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/(parent)/onboard" as Href)} style={s.btnSecondary}>
            <Ionicons name="person-add" size={16} color={colors.text} />
            <Text style={s.btnSecondaryText}>Add learner</Text>
          </Pressable>
        </View>
      </View>

      <Text style={s.sectionLabel}>Today at a glance</Text>
      <View style={s.metricGrid}>
        <MetricCard
          label="Baseline status"
          value="In progress"
          description="60% of discovery adventure complete."
          iconName="sparkles"
          tone="info"
          onPress={() => router.push("/(parent)/progress/emma" as Href)}
        />
        <MetricCard
          label="Wellbeing"
          value="Calm"
          description="No stress flags this week."
          iconName="heart"
          tone="success"
          onPress={() => router.push("/(parent)/progress/emma" as Href)}
        />
        <MetricCard
          label="Mastery"
          value="+4 skills"
          description="This week."
          iconName="trending-up"
          tone="success"
          onPress={() => router.push("/(parent)/milestones/emma" as Href)}
        />
        <MetricCard
          label="Today's time"
          value="22 min"
          description="Planned: 35 minutes."
          iconName="time"
          onPress={() => router.push("/(parent)/session/emma" as Href)}
        />
        <MetricCard
          label="Needs approval"
          value="1 thing"
          description="Approve voice mode."
          iconName="shield-checkmark"
          tone="warning"
          onPress={() => router.push("/(parent)/settings" as Href)}
        />
        <MetricCard
          label="IEP support"
          value="Active"
          description="3 accommodations applied."
          iconName="document-text"
          tone="info"
          onPress={() => router.push("/(parent)/iep/emma" as Href)}
        />
      </View>

      <Text style={s.sectionLabel}>Details</Text>
      <View style={s.list}>
        <SectionRow
          iconName="sparkles"
          title="Learning readiness"
          subtitle="Today's plan, pacing, and sensory mode."
          badge="Ready"
          onPress={() => router.push("/(parent)/session/emma" as Href)}
        />
        <SectionRow
          iconName="checkmark-circle"
          title="Consent checklist"
          subtitle="What you've approved and what's still optional."
          badge="2 of 3"
          onPress={() => router.push("/(parent)/settings" as Href)}
        />
        <SectionRow
          iconName="document-text"
          title="IEP / support upload"
          subtitle="3 accommodations extracted."
          onPress={() => router.push("/(parent)/iep/emma" as Href)}
        />
        <SectionRow
          iconName="notifications"
          title="Notifications"
          subtitle="1 new milestone, tutor note."
          badge="1"
          onPress={() => router.push("/(parent)/inbox" as Href)}
        />
        <SectionRow
          iconName="card"
          title="Billing"
          subtitle="Family · monthly. Next renewal Apr 14."
          onPress={() => router.push("/(parent)/billing" as Href)}
        />
        <SectionRow
          iconName="school"
          title="School connection"
          subtitle="Not linked. Tap to connect a school."
          onPress={() => router.push("/(parent)/team/emma" as Href)}
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
  heroSubhead: { fontFamily: fontFamilies.displaySemiBold, fontSize: 18, color: colors.textSecondary },
  heroBody: { fontFamily: fontFamilies.bodyRegular, fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs },
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
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  metricCard: {
    flexBasis: "48%",
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  metricLabel: { fontFamily: fontFamilies.bodyRegular, fontSize: 12, color: colors.textSecondary },
  metricValue: { fontFamily: fontFamilies.displaySemiBold, fontSize: 18, color: colors.text },
  metricDesc: { fontFamily: fontFamilies.bodyRegular, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
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
  rowIcon: { width: 32, height: 32, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontFamily: fontFamilies.bodyBold, fontSize: 14, color: colors.text },
  rowSubtitle: { fontFamily: fontFamilies.bodyRegular, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  rowBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: colors.background,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowBadgeText: { fontFamily: fontFamilies.bodySemiBold, fontSize: 11, color: colors.textSecondary },
  footer: {
    textAlign: "center",
    fontFamily: fontFamilies.bodyRegular,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
});
