import React from "react";
import { View, Text, Pressable, StyleSheet, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { useAudioPreferences } from "@/lib/preferences";
import { VOICES, MIN_SPEED, MAX_SPEED, clampSpeed } from "@/lib/preferences-logic";
import { Card } from "@/components/ui";
import { spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

const SPEED_STEP = 0.1;

/**
 * Learner audio / voice settings — mirror of web's
 * `/learner/settings/audio` (MOB-LRN-014). Voice + speed + master TTS
 * toggle, persisted per-device via `usePreferences`.
 */
export default function LearnerAudioScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { prefs, setPref } = useAudioPreferences();

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
          {t("audio.title", "Audio & voice")}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <Card tone="raised" style={styles.card}>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1, paddingRight: spacing.sm }}>
            <Text style={[styles.sectionTitle, { color: palette.ink }]}>
              {t("audio.enable", "Spoken audio")}
            </Text>
            <Text style={[styles.desc, { color: palette.inkMuted }]}>
              {t("audio.enableDesc", "Read lessons, questions, and tutor replies aloud.")}
            </Text>
          </View>
          <Switch
            value={prefs.ttsEnabled}
            onValueChange={(v) => setPref({ ttsEnabled: v })}
            trackColor={{ false: palette.border, true: palette.primary }}
            thumbColor={palette.bgRaised}
            accessibilityLabel={t("audio.enable", "Spoken audio")}
          />
        </View>
      </Card>

      <Card tone="raised" style={[styles.card, !prefs.ttsEnabled && { opacity: 0.5 }]}>
        <Text style={[styles.sectionTitle, { color: palette.ink }]}>
          {t("audio.voice", "Voice")}
        </Text>
        <View style={styles.voiceGrid}>
          {VOICES.map((v) => {
            const active = prefs.voiceId === v.id;
            return (
              <Pressable
                key={v.id}
                disabled={!prefs.ttsEnabled}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled: !prefs.ttsEnabled }}
                accessibilityLabel={v.label}
                onPress={() => setPref({ voiceId: v.id })}
                style={[
                  styles.voiceChip,
                  {
                    borderColor: active ? palette.primary : palette.border,
                    backgroundColor: active ? palette.primary : palette.bgRaised,
                  },
                ]}
              >
                <Text
                  style={[styles.voiceChipText, { color: active ? palette.bgRaised : palette.ink }]}
                >
                  {v.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card tone="raised" style={[styles.card, !prefs.ttsEnabled && { opacity: 0.5 }]}>
        <Text style={[styles.sectionTitle, { color: palette.ink }]}>
          {t("audio.speed", "Speed")}
        </Text>
        <View style={styles.speedRow}>
          <SpeedButton
            icon="remove"
            disabled={!prefs.ttsEnabled || prefs.speed <= MIN_SPEED}
            onPress={() => setPref({ speed: clampSpeed(+(prefs.speed - SPEED_STEP).toFixed(2)) })}
            palette={palette}
            label={t("audio.slower", "Slower")}
          />
          <View style={styles.speedValueWrap}>
            <Text style={[styles.speedValue, { color: palette.ink }]}>
              {prefs.speed.toFixed(1)}×
            </Text>
          </View>
          <SpeedButton
            icon="add"
            disabled={!prefs.ttsEnabled || prefs.speed >= MAX_SPEED}
            onPress={() => setPref({ speed: clampSpeed(+(prefs.speed + SPEED_STEP).toFixed(2)) })}
            palette={palette}
            label={t("audio.faster", "Faster")}
          />
        </View>
      </Card>

      <Text style={[styles.footnote, { color: palette.inkMuted }]}>
        {t("audio.captionsNote", "Captions are set in Accessibility.")}
      </Text>
    </ResponsiveScreen>
  );
}

function SpeedButton({
  icon,
  disabled,
  onPress,
  palette,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  onPress: () => void;
  palette: ReturnType<typeof useSensoryPalette>;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={[
        styles.speedBtn,
        {
          borderColor: palette.border,
          backgroundColor: palette.bgRaised,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={22} color={palette.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
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
  card: { marginBottom: spacing.md, gap: 4 },
  sectionTitle: { fontSize: 16, fontFamily: fontFamilies.displayBold, marginBottom: 2 },
  desc: { fontSize: 12, fontFamily: fontFamilies.bodyRegular },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  voiceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.sm },
  voiceChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  voiceChipText: { fontSize: 13, fontFamily: fontFamilies.bodyBold },
  speedRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.sm },
  speedBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  speedValueWrap: { flex: 1, alignItems: "center" },
  speedValue: { fontSize: 22, fontFamily: fontFamilies.displayBold },
  footnote: {
    fontSize: 12,
    fontFamily: fontFamilies.bodyRegular,
    textAlign: "center",
    marginTop: spacing.xs,
  },
});
