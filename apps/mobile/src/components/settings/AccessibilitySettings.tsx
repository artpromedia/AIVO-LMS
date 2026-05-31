import React from "react";
import { View, Text, Pressable, StyleSheet, Switch } from "react-native";
import { useTranslation } from "@/hooks/useTranslation";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { useA11yPreferences } from "@/lib/preferences";
import { TEXT_SCALES, type TextScale } from "@/lib/preferences-logic";
import { Card, SensoryToggle } from "@/components/ui";
import { spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

/**
 * Shared accessibility settings body, reused by the global
 * (`/settings/accessibility`) and learner (`/(learner)/accessibility`)
 * routes. Renders content cards only — the host route supplies the
 * screen scaffold (header + ResponsiveScreen) so the same controls can
 * be framed for "everyone" or for a single learner.
 *
 * Mirrors web's Settings → Accessibility: sensory mode, text size, and
 * the reduce-motion / read-aloud / captions toggles. Sensory mode is
 * the load-bearing control (backend-synced via SensoryModeProvider);
 * the rest persist per-device through `usePreferences`.
 */
export interface AccessibilitySettingsProps {
  /** Short line clarifying who these settings apply to. */
  scopeNote?: string;
}

export function AccessibilitySettings({ scopeNote }: AccessibilitySettingsProps) {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { prefs, setPref, scale } = useA11yPreferences();

  const TextSizeLabel: Record<TextScale, string> = {
    small: t("a11y.textSmall", "Small"),
    medium: t("a11y.textMedium", "Medium"),
    large: t("a11y.textLarge", "Large"),
  };

  return (
    <View style={{ gap: spacing.md }}>
      {scopeNote ? (
        <Text style={[styles.scopeNote, { color: palette.inkMuted }]}>{scopeNote}</Text>
      ) : null}

      {/* Sensory mode — headline control, backend-synced. */}
      <Card tone="raised" style={styles.card}>
        <Text style={[styles.sectionTitle, { color: palette.ink }]}>
          {t("a11y.sensoryMode", "Sensory mode")}
        </Text>
        <Text style={[styles.desc, { color: palette.inkMuted }]}>
          {t(
            "a11y.sensoryModeDesc",
            "Switch between standard, calm, and high-contrast at any time. Your choice syncs across devices.",
          )}
        </Text>
        <View style={{ marginTop: spacing.sm }}>
          <SensoryToggle variant="segmented" />
        </View>
      </Card>

      {/* Text size */}
      <Card tone="raised" style={styles.card}>
        <Text style={[styles.sectionTitle, { color: palette.ink }]}>
          {t("a11y.textSize", "Text size")}
        </Text>
        <Text style={[styles.desc, { color: palette.inkMuted }]}>
          {t("a11y.textSizeDesc", "Make body text easier to read.")}
        </Text>
        <View style={[styles.segment, { borderColor: palette.border, marginTop: spacing.sm }]}>
          {TEXT_SCALES.map((size) => {
            const active = prefs.textScale === size;
            return (
              <Pressable
                key={size}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={TextSizeLabel[size]}
                onPress={() => setPref({ textScale: size })}
                style={[styles.segmentItem, active && { backgroundColor: palette.primary }]}
              >
                <Text
                  style={[styles.segmentText, { color: active ? palette.bgRaised : palette.ink }]}
                >
                  {TextSizeLabel[size]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {/* Live preview honouring the chosen scale. */}
        <View
          style={[styles.preview, { backgroundColor: palette.bgPage, borderColor: palette.border }]}
        >
          <Text
            style={{
              color: palette.ink,
              fontFamily: fontFamilies.bodyRegular,
              fontSize: scale(15),
            }}
          >
            {t("a11y.previewText", "The quick brown fox jumps over the lazy dog.")}
          </Text>
        </View>
      </Card>

      {/* Motion & reading toggles */}
      <Card tone="raised" style={styles.card}>
        <Text style={[styles.sectionTitle, { color: palette.ink }]}>
          {t("a11y.motionAndReading", "Motion & reading")}
        </Text>
        <ToggleRow
          title={t("a11y.reduceMotion", "Reduce motion")}
          desc={t("a11y.reduceMotionDesc", "Stops non-essential animations and transitions.")}
          value={prefs.reduceMotion}
          onChange={(v) => setPref({ reduceMotion: v })}
          palette={palette}
        />
        <ToggleRow
          title={t("a11y.readAloud", "Read aloud by default")}
          desc={t("a11y.readAloudDesc", "Start lessons and tutor replies with audio playing.")}
          value={prefs.readAloudDefault}
          onChange={(v) => setPref({ readAloudDefault: v })}
          palette={palette}
        />
        <ToggleRow
          title={t("a11y.captions", "Always show captions")}
          desc={t("a11y.captionsDesc", "Show captions on spoken audio and video.")}
          value={prefs.captionsDefault}
          onChange={(v) => setPref({ captionsDefault: v })}
          palette={palette}
          last
        />
      </Card>
    </View>
  );
}

function ToggleRow({
  title,
  desc,
  value,
  onChange,
  palette,
  last,
}: {
  title: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
  palette: ReturnType<typeof useSensoryPalette>;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.toggleRow,
        { borderBottomColor: palette.border, borderBottomWidth: last ? 0 : 1 },
      ]}
    >
      <View style={{ flex: 1, paddingRight: spacing.sm }}>
        <Text style={[styles.toggleTitle, { color: palette.ink }]}>{title}</Text>
        <Text style={[styles.toggleDesc, { color: palette.inkMuted }]}>{desc}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: palette.border, true: palette.primary }}
        thumbColor={palette.bgRaised}
        accessibilityLabel={title}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scopeNote: { fontSize: 13, fontFamily: fontFamilies.bodyRegular },
  card: { gap: 4 },
  sectionTitle: { fontSize: 16, fontFamily: fontFamilies.displayBold, marginBottom: 2 },
  desc: { fontSize: 12, fontFamily: fontFamilies.bodyRegular },
  segment: { flexDirection: "row", borderWidth: 1, borderRadius: radius.lg, overflow: "hidden" },
  segmentItem: { flex: 1, paddingVertical: 10, alignItems: "center" },
  segmentText: { fontSize: 14, fontFamily: fontFamilies.bodyBold },
  preview: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  toggleTitle: { fontSize: 14, fontFamily: fontFamilies.bodyBold },
  toggleDesc: { fontSize: 12, fontFamily: fontFamilies.bodyRegular, marginTop: 2 },
});
