import React, { useEffect, useState, useCallback } from "react";
import { View, Text, Pressable, StyleSheet, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { Card, Button, SensoryToggle } from "@/components/ui";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";

const STORAGE_KEY = "aivo_learner_prefs_v1";

interface LearnerPrefs {
  soundEffects: boolean;
  music: boolean;
  animations: boolean;
  largeText: boolean;
}

const DEFAULT_PREFS: LearnerPrefs = {
  soundEffects: true,
  music: true,
  animations: true,
  largeText: false,
};

export default function LearnerSettingsScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const palette = useSensoryPalette();
  const [prefs, setPrefs] = useState<LearnerPrefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as Partial<LearnerPrefs>;
            setPrefs({ ...DEFAULT_PREFS, ...parsed });
          } catch {
            /* ignore */
          }
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  const update = useCallback(<K extends keyof LearnerPrefs>(key: K, value: LearnerPrefs[K]) => {
    setPrefs((p) => ({ ...p, [key]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }, [prefs]);

  if (!loaded) return null;

  const renderToggleRow = (key: keyof LearnerPrefs, titleKey: string, descKey: string) => (
    <View
      style={[styles.toggleRow, { borderBottomColor: palette.border }]}
      key={key}
    >
      <View style={{ flex: 1, paddingRight: spacing.sm }}>
        <Text style={[styles.toggleTitle, { color: palette.ink }]}>{t(titleKey)}</Text>
        <Text style={[styles.toggleDesc, { color: palette.inkMuted }]}>{t(descKey)}</Text>
      </View>
      <Switch
        value={prefs[key]}
        onValueChange={(v) => update(key, v)}
        trackColor={{ false: palette.border, true: palette.primary }}
        thumbColor={palette.bgRaised}
        accessibilityLabel={t(titleKey)}
      />
    </View>
  );

  return (
    <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          hitSlop={8}
          style={[
            styles.backBtn,
            { backgroundColor: palette.bgRaised, borderColor: palette.border },
          ]}
        >
          <Ionicons name="chevron-back" size={22} color={palette.ink} />
        </Pressable>
        <Text style={[styles.title, { color: palette.ink }]}>
          {t("learnerSettings.title")}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <Card tone="raised" style={styles.card}>
        <Text style={[styles.sectionTitle, { color: palette.ink }]}>
          {t("learnerSettings.profile")}
        </Text>
        <View style={[styles.profileRow, { borderBottomColor: palette.border }]}>
          <Text style={[styles.profileLabel, { color: palette.inkMuted }]}>
            {t("learnerSettings.name")}
          </Text>
          <Text style={[styles.profileValue, { color: palette.ink }]}>{user?.name ?? "—"}</Text>
        </View>
        <View style={[styles.profileRow, { borderBottomColor: palette.border }]}>
          <Text style={[styles.profileLabel, { color: palette.inkMuted }]}>
            {t("learnerSettings.role")}
          </Text>
          <Text style={[styles.profileValue, { color: palette.primary }]}>
            {t("learnerSettings.learner")}
          </Text>
        </View>
      </Card>

      {/* Sensory mode — the headline accessibility control for the
          inclusive-warm rollout. Lives at the top of accessibility so
          it surfaces ahead of legacy toggles. */}
      <Card tone="raised" style={styles.card}>
        <Text style={[styles.sectionTitle, { color: palette.ink }]}>
          Sensory mode
        </Text>
        <Text style={[styles.toggleDesc, { color: palette.inkMuted, marginBottom: 12 }]}>
          Switch between standard, calm, and high-contrast at any time. Your choice syncs across devices.
        </Text>
        <SensoryToggle variant="segmented" />
      </Card>

      <Card tone="raised" style={styles.card}>
        <Text style={[styles.sectionTitle, { color: palette.ink }]}>
          {t("learnerSettings.soundAndMotion")}
        </Text>
        {renderToggleRow(
          "soundEffects",
          "learnerSettings.soundEffects",
          "learnerSettings.soundEffectsDesc",
        )}
        {renderToggleRow("music", "learnerSettings.music", "learnerSettings.musicDesc")}
        {renderToggleRow(
          "animations",
          "learnerSettings.animations",
          "learnerSettings.animationsDesc",
        )}
      </Card>

      <Card tone="raised" style={styles.card}>
        <Text style={[styles.sectionTitle, { color: palette.ink }]}>
          {t("learnerSettings.accessibility")}
        </Text>
        {renderToggleRow("largeText", "learnerSettings.largeText", "learnerSettings.largeTextDesc")}
      </Card>

      {saved && (
        <View
          style={[
            styles.savedBanner,
            { backgroundColor: "rgba(22, 163, 74, 0.10)" },
          ]}
        >
          <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
          <Text style={styles.savedText}>{t("learnerSettings.saved")}</Text>
        </View>
      )}

      <Button
        title={t("learnerSettings.saveChanges")}
        onPress={handleSave}
        fullWidth
        size="lg"
        style={{ marginTop: spacing.md }}
      />
    </ResponsiveScreen>
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
  card: { marginBottom: spacing.md },
  sectionTitle: {
    fontSize: 16,
    fontFamily: fontFamilies.displayBold,
    marginBottom: spacing.sm,
  },
  profileRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  profileLabel: {
    fontSize: 12,
    fontFamily: fontFamilies.bodySemiBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  profileValue: { fontSize: 14, fontFamily: fontFamilies.bodyBold },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  toggleTitle: { fontSize: 14, fontFamily: fontFamilies.bodyBold },
  toggleDesc: {
    fontSize: 12,
    fontFamily: fontFamilies.bodyRegular,
    marginTop: 2,
  },
  savedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: radius.lg,
    marginTop: spacing.sm,
  },
  savedText: { fontSize: 13, fontFamily: fontFamilies.bodyBold, color: "#16a34a" },
});
