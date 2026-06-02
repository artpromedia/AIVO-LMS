import React from "react";
import { View, Text, Pressable, StyleSheet, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useLearner } from "@/hooks/useLearners";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { useAudioPreferences } from "@/lib/preferences";
import { VOICES, MIN_SPEED, MAX_SPEED, clampSpeed } from "@/lib/preferences-logic";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { Card } from "@/components/ui";
import { spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

const SPEED_STEP = 0.1;

/**
 * Parent per-learner audio prefs (MOB-PAR-017) — mirror of web's
 * `/parent/learners/[learnerId]/accessibility/audio`. Voice + speed +
 * spoken-audio toggle.
 */
export default function ParentLearnerAudioScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const { data: learner } = useLearner(childId ?? "");
  const { prefs, setPref } = useAudioPreferences();

  return (
    <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
      <ScreenHeader title={t("audio.title", "Audio & voice")} />
      {learner ? (
        <Text style={[styles.subtitle, { color: palette.inkMuted }]}>
          {t("parentAudio.for", {
            name: learner.firstName,
            defaultValue: `Voice settings for ${learner.firstName}`,
          })}
        </Text>
      ) : null}

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
          <Pressable
            disabled={!prefs.ttsEnabled || prefs.speed <= MIN_SPEED}
            accessibilityRole="button"
            accessibilityLabel={t("audio.slower", "Slower")}
            onPress={() => setPref({ speed: clampSpeed(+(prefs.speed - SPEED_STEP).toFixed(2)) })}
            style={[
              styles.speedBtn,
              { borderColor: palette.border, backgroundColor: palette.bgRaised },
            ]}
          >
            <Ionicons name="remove" size={22} color={palette.ink} />
          </Pressable>
          <Text style={[styles.speedValue, { color: palette.ink }]}>{prefs.speed.toFixed(1)}×</Text>
          <Pressable
            disabled={!prefs.ttsEnabled || prefs.speed >= MAX_SPEED}
            accessibilityRole="button"
            accessibilityLabel={t("audio.faster", "Faster")}
            onPress={() => setPref({ speed: clampSpeed(+(prefs.speed + SPEED_STEP).toFixed(2)) })}
            style={[
              styles.speedBtn,
              { borderColor: palette.border, backgroundColor: palette.bgRaised },
            ]}
          >
            <Ionicons name="add" size={22} color={palette.ink} />
          </Pressable>
        </View>
      </Card>
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 14, fontFamily: fontFamilies.bodyRegular, marginBottom: spacing.sm },
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
  speedValue: { flex: 1, textAlign: "center", fontSize: 22, fontFamily: fontFamilies.displayBold },
});
