import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useSensoryProfile } from "@/hooks/useSensory";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { Card } from "@/components/ui";
import { LoadingState, EmptyState } from "@aivo/mobile-ui";
import { colors, spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

type Channel = "visual" | "auditory" | "tactile" | "vestibular";

const CHANNELS: { key: Channel; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { key: "visual", icon: "eye", label: "Visual" },
  { key: "auditory", icon: "ear", label: "Auditory" },
  { key: "tactile", icon: "hand-left", label: "Tactile" },
  { key: "vestibular", icon: "body", label: "Movement" },
];

const SENS_TONE: Record<string, string> = {
  low: colors.success,
  moderate: colors.warning,
  high: colors.error,
};

/**
 * Parent sensory profile (MOB-PAR-013) — mirror of web's
 * `/parent/learners/[learnerId]/sensory`. Per-channel sensitivity +
 * accommodations from brain-svc.
 */
export default function ParentSensoryScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const { data: profile, isLoading } = useSensoryProfile(childId ?? "");

  return (
    <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
      <ScreenHeader title={t("parentSensory.title", "Sensory profile")} />

      {isLoading ? (
        <LoadingState />
      ) : !profile ? (
        <EmptyState
          icon={<Ionicons name="color-palette-outline" size={48} color={palette.inkMuted} />}
          title={t("parentSensory.emptyTitle", "No sensory profile yet")}
          message={t("parentSensory.emptyBody", "This appears once the brain profile is built.")}
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          {CHANNELS.map((c) => {
            const channel = profile[c.key];
            if (!channel) return null;
            const tone = SENS_TONE[channel.sensitivity] ?? palette.primary;
            return (
              <Card key={c.key} tone="raised" style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={[styles.iconWrap, { backgroundColor: `${tone}1A` }]}>
                    <Ionicons name={c.icon} size={20} color={tone} />
                  </View>
                  <Text style={[styles.channelLabel, { color: palette.ink }]}>
                    {t(`parentSensory.${c.key}`, c.label)}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: `${tone}1A` }]}>
                    <Text style={[styles.badgeText, { color: tone }]}>
                      {t(`parentSensory.sens.${channel.sensitivity}`, channel.sensitivity)}
                    </Text>
                  </View>
                </View>
                {channel.accommodations.length > 0 ? (
                  <View style={styles.accoms}>
                    {channel.accommodations.map((a) => (
                      <View
                        key={a}
                        style={[
                          styles.chip,
                          { borderColor: palette.border, backgroundColor: palette.bgPage },
                        ]}
                      >
                        <Text style={[styles.chipText, { color: palette.ink }]}>{a}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={[styles.none, { color: palette.inkMuted }]}>
                    {t("parentSensory.noAccoms", "No specific accommodations.")}
                  </Text>
                )}
              </Card>
            );
          })}
        </View>
      )}
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  channelLabel: { flex: 1, fontSize: 16, fontFamily: fontFamilies.bodyBold },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  badgeText: { fontSize: 12, fontFamily: fontFamilies.bodyBold, textTransform: "capitalize" },
  accoms: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.lg, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: fontFamilies.bodySemiBold },
  none: { fontSize: 13, fontFamily: fontFamilies.bodyRegular },
});
