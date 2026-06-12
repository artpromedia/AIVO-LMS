/**
 * Periodic break prompt for the "Break reminders" accessibility preference.
 *
 * Mounted once in the learner layout. While `breakReminders` is on it shows a
 * gentle, dismissible modal every `breakIntervalMinutes` and announces it to
 * screen readers. Mirrors the web lesson player's break-reminder behaviour so
 * the two platforms are at parity.
 */
import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useA11yPreferences } from "@/lib/preferences";
import { useA11yStyle } from "@/lib/a11y-style";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { useTranslation } from "@/hooks/useTranslation";
import { spacing, radius } from "@/constants/colors";

export function BreakReminder() {
  const { prefs } = useA11yPreferences();
  const { announce, bodyFontFamily } = useA11yStyle();
  const reducedMotion = useReducedMotion();
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!prefs.breakReminders) return;
    const ms = Math.max(2, prefs.breakIntervalMinutes) * 60_000;
    const id = setInterval(() => {
      setOpen(true);
      announce(t("a11y.breakAnnounce", "Time for a quick break."));
    }, ms);
    return () => clearInterval(id);
  }, [prefs.breakReminders, prefs.breakIntervalMinutes, announce, t]);

  return (
    <Modal
      transparent
      visible={open}
      animationType={reducedMotion ? "none" : "fade"}
      onRequestClose={() => setOpen(false)}
    >
      <View style={styles.backdrop}>
        <View
          accessibilityRole="alert"
          accessibilityLabel={t("a11y.breakTitle", "Time for a break")}
          style={[styles.sheet, { backgroundColor: palette.bgRaised, borderColor: palette.border }]}
        >
          <Text style={[styles.title, { color: palette.ink, fontFamily: bodyFontFamily }]}>
            {t("a11y.breakHeadline", "Nice work — want to rest?")}
          </Text>
          <Text style={[styles.body, { color: palette.inkMuted, fontFamily: bodyFontFamily }]}>
            {t("a11y.breakBody", "Take a slow breath. Your spot is saved.")}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("a11y.breakKeepGoing", "Keep going")}
            onPress={() => setOpen(false)}
            style={[styles.cta, { backgroundColor: palette.primary }]}
          >
            <Text style={[styles.ctaText, { color: palette.bgRaised, fontFamily: bodyFontFamily }]}>
              {t("a11y.breakKeepGoing", "Keep going")}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    padding: spacing.lg,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  sheet: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, gap: 6 },
  title: { fontSize: 16, fontWeight: "700" },
  body: { fontSize: 13 },
  cta: {
    marginTop: spacing.md,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 11,
    minHeight: 48,
    justifyContent: "center",
  },
  ctaText: { fontSize: 14, fontWeight: "700" },
});
