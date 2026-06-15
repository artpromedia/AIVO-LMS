import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { Card } from "@/components/ui";
import { EmptyState } from "@aivo/mobile-ui";
import { spacing } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

interface QuickLink {
  href: Href;
  icon: IoniconName;
  titleKey: string;
  titleDefault: string;
  descKey: string;
  descDefault: string;
}

/**
 * Parent resources (MOB-PAR-021) — mirror of web's `/parent/resources`. An
 * honest hub: quick links to real in-app destinations the parent already
 * has, plus a truthful empty state for the curated library that is not yet
 * built. No fabricated content — when the library ships it replaces the
 * empty state.
 */
const QUICK_LINKS: QuickLink[] = [
  {
    href: "/(parent)/reports" as Href,
    icon: "bar-chart-outline",
    titleKey: "parentResources.reportsLink",
    titleDefault: "Reports",
    descKey: "parentResources.reportsDesc",
    descDefault: "Weekly mastery and progress for each learner.",
  },
  {
    href: "/(parent)/inbox" as Href,
    icon: "mail-outline",
    titleKey: "parentResources.messagesLink",
    titleDefault: "Messages",
    descKey: "parentResources.messagesDesc",
    descDefault: "Talk with your learner's care team.",
  },
  {
    href: "/(parent)/privacy" as Href,
    icon: "lock-closed-outline",
    titleKey: "parentResources.privacyLink",
    titleDefault: "Privacy & data",
    descKey: "parentResources.privacyDesc",
    descDefault: "Review consent, export, or delete data.",
  },
  {
    href: "/(parent)/settings" as Href,
    icon: "settings-outline",
    titleKey: "parentResources.settingsLink",
    titleDefault: "Settings",
    descKey: "parentResources.settingsDesc",
    descDefault: "Manage your account and preferences.",
  },
];

export default function ParentResourcesScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();

  return (
    <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
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
        <Text style={[styles.title, { color: palette.ink }]}>
          {t("parentResources.title", "Resources")}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <Text style={[styles.intro, { color: palette.inkMuted }]}>
        {t(
          "parentResources.intro",
          "Quick links to the tools you already have. A curated library of guides is on the way.",
        )}
      </Text>

      <View style={{ gap: spacing.sm }}>
        {QUICK_LINKS.map((link) => (
          <Pressable
            key={link.titleKey}
            accessibilityRole="button"
            accessibilityLabel={t(link.titleKey, link.titleDefault)}
            onPress={() => router.push(link.href)}
          >
            <Card tone="raised" style={styles.linkCard}>
              <View style={[styles.iconWrap, { backgroundColor: palette.accentSoft }]}>
                <Ionicons name={link.icon} size={20} color={palette.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.linkTitle, { color: palette.ink }]}>
                  {t(link.titleKey, link.titleDefault)}
                </Text>
                <Text style={[styles.linkDesc, { color: palette.inkMuted }]}>
                  {t(link.descKey, link.descDefault)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={palette.inkMuted} />
            </Card>
          </Pressable>
        ))}
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <Text style={[styles.sectionLabel, { color: palette.ink }]}>
          {t("parentResources.libraryTitle", "Guides & library")}
        </Text>
        <View style={{ marginTop: spacing.sm }}>
          <EmptyState
            icon={<Ionicons name="library-outline" size={48} color={palette.inkMuted} />}
            title={t("parentResources.libraryEmptyTitle", "Library coming soon")}
            message={t(
              "parentResources.libraryEmptyBody",
              "Curated guides for supporting your learner aren't available yet. We'll add them here when they're ready.",
            )}
          />
        </View>
      </View>
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 22, fontFamily: fontFamilies.displayBold },
  intro: {
    fontSize: 14,
    fontFamily: fontFamilies.bodyRegular,
    marginBottom: spacing.md,
  },
  linkCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  linkTitle: { fontSize: 16, fontFamily: fontFamilies.bodyBold },
  linkDesc: { fontSize: 13, fontFamily: fontFamilies.bodyRegular, marginTop: 2 },
  sectionLabel: { fontSize: 16, fontFamily: fontFamilies.displayBold },
});
