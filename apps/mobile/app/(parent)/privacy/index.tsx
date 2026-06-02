import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { Card } from "@/components/ui";
import { spacing } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

/**
 * Parent privacy hub (MOB-PAR-022) — mirror of web's `/parent/privacy`.
 * Links to consent, data export, and deletion.
 */
export default function ParentPrivacyScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();

  const LINKS: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    desc: string;
    route: string;
    tone?: string;
  }[] = [
    {
      icon: "shield-checkmark-outline",
      label: t("parentPrivacy.consent", "Consent & approvals"),
      desc: t("parentPrivacy.consentDesc", "Review what you've agreed to."),
      route: "/(parent)/consent",
    },
    {
      icon: "download-outline",
      label: t("parentPrivacy.export", "Export your data"),
      desc: t("parentPrivacy.exportDesc", "Get a copy of your account data."),
      route: "/(parent)/privacy/data-export",
    },
    {
      icon: "trash-outline",
      label: t("parentPrivacy.delete", "Delete data"),
      desc: t("parentPrivacy.deleteDesc", "Request deletion of your data."),
      route: "/(parent)/privacy/delete-data",
      tone: "#ef4444",
    },
  ];

  return (
    <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
      <ScreenHeader title={t("parentPrivacy.title", "Privacy")} />
      <View style={{ gap: spacing.md }}>
        {LINKS.map((l) => (
          <Pressable
            key={l.route}
            accessibilityRole="button"
            accessibilityLabel={l.label}
            onPress={() => router.push(l.route as Href)}
          >
            <Card tone="raised" style={styles.row}>
              <View
                style={[styles.iconWrap, { backgroundColor: `${l.tone ?? palette.primary}1A` }]}
              >
                <Ionicons name={l.icon} size={20} color={l.tone ?? palette.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: palette.ink }]}>{l.label}</Text>
                <Text style={[styles.desc, { color: palette.inkMuted }]}>{l.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={palette.inkMuted} />
            </Card>
          </Pressable>
        ))}
      </View>
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 15, fontFamily: fontFamilies.bodyBold },
  desc: { fontSize: 13, fontFamily: fontFamilies.bodyRegular, marginTop: 2 },
});
