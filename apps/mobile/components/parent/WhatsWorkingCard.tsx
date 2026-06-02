import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useWhatsWorking } from "@/hooks/useFamily";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { Card } from "@/components/ui";
import { colors, spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

const TOD: Record<string, string> = {
  "early-morning": "Early morning",
  morning: "Morning",
  midday: "Midday",
  afternoon: "Afternoon",
  evening: "Evening",
};
const MODALITY: Record<string, string> = {
  visual: "Visual",
  auditory: "Auditory",
  kinesthetic: "Hands-on",
  reading: "Reading",
  unknown: "Mixed",
};

/**
 * Parent "What's Working" card — mirror of the web panel. Surfaces the three
 * IEP-ready signals (best learning window, modality that clicks, where
 * frustration spikes) from family-svc's whats-working analytics.
 */
export function WhatsWorkingCard({
  learnerId,
  learnerName,
}: {
  learnerId: string;
  learnerName: string;
}) {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const [windowDays, setWindowDays] = useState(30);
  const { data, isLoading, isError } = useWhatsWorking(learnerId, windowDays);

  const pct = (n: number) => Math.round(n * 100);
  const topFit =
    data && data.modalityFit.length > 0
      ? [...data.modalityFit].sort((a, b) => b.meanAccuracy - a.meanAccuracy)[0]
      : null;
  const topHotspot = data?.frustrationHotspots[0] ?? null;

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: palette.ink }]}>
          {t("whatsWorking.title", "What's working")}
        </Text>
        <View style={styles.toggle}>
          {[30, 90].map((w) => {
            const active = windowDays === w;
            return (
              <Pressable
                key={w}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setWindowDays(w)}
                style={[
                  styles.toggleBtn,
                  {
                    backgroundColor: active ? palette.accent : palette.bgPage,
                    borderColor: palette.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.toggleText,
                    { color: active ? palette.bgRaised : palette.inkMuted },
                  ]}
                >
                  {w === 30
                    ? t("whatsWorking.window30", "30 days")
                    : t("whatsWorking.window90", "90 days")}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Text style={[styles.intro, { color: palette.inkMuted }]}>
        {t("whatsWorking.intro", "Patterns to bring to your next IEP meeting.")}
      </Text>

      {isLoading ? (
        <Text style={[styles.muted, { color: palette.inkMuted }]}>
          {t("whatsWorking.loading", "Loading insights…")}
        </Text>
      ) : isError ? (
        <Text style={[styles.muted, { color: colors.error }]}>
          {t("whatsWorking.error", "Couldn't load insights right now.")}
        </Text>
      ) : !data || data.totalSessions === 0 ? (
        <Text style={[styles.muted, { color: palette.inkMuted }]}>
          {t("whatsWorking.empty", `Not enough sessions yet for ${learnerName}.`)}
        </Text>
      ) : (
        <View style={styles.signals}>
          <Signal
            icon="time-outline"
            tint={palette.accent}
            palette={palette}
            label={t("whatsWorking.bestWindow", "Best learning window")}
            value={
              data.bestWindow ? (TOD[data.bestWindow.timeOfDay] ?? data.bestWindow.timeOfDay) : "—"
            }
            sub={data.bestWindow ? `${pct(data.bestWindow.meanAccuracy)}% accuracy` : undefined}
          />
          <Signal
            icon="sparkles-outline"
            tint={colors.success}
            palette={palette}
            label={t("whatsWorking.modalityFit", "Modality that clicks")}
            value={topFit ? (MODALITY[topFit.modality] ?? topFit.modality) : "—"}
            sub={topFit ? `${pct(topFit.meanAccuracy)}% · ${topFit.subject}` : undefined}
          />
          <Signal
            icon="alert-circle-outline"
            tint={colors.error}
            palette={palette}
            label={t("whatsWorking.frustration", "Where frustration spikes")}
            value={topHotspot ? topHotspot.subject : "—"}
            sub={topHotspot ? (MODALITY[topHotspot.modality] ?? topHotspot.modality) : undefined}
          />
        </View>
      )}
    </Card>
  );
}

function Signal({
  icon,
  tint,
  palette,
  label,
  value,
  sub,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  palette: ReturnType<typeof useSensoryPalette>;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <View style={[styles.signal, { borderColor: palette.border }]}>
      <Ionicons name={icon} size={20} color={tint} />
      <Text style={[styles.signalLabel, { color: palette.inkMuted }]}>{label}</Text>
      <Text style={[styles.signalValue, { color: palette.ink }]}>{value}</Text>
      {sub ? <Text style={[styles.signalSub, { color: palette.inkMuted }]}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md, gap: spacing.xs },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 16, fontFamily: fontFamilies.displayBold },
  toggle: { flexDirection: "row", gap: 6 },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  toggleText: { fontSize: 12, fontFamily: fontFamilies.bodyBold },
  intro: { fontSize: 13, fontFamily: fontFamilies.bodyRegular, marginBottom: spacing.xs },
  muted: { fontSize: 14, fontFamily: fontFamilies.bodyRegular, paddingVertical: spacing.sm },
  signals: { flexDirection: "row", gap: spacing.sm },
  signal: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.sm,
    gap: 4,
  },
  signalLabel: { fontSize: 10, fontFamily: fontFamilies.bodyBold, textTransform: "uppercase" },
  signalValue: { fontSize: 14, fontFamily: fontFamilies.displayBold },
  signalSub: { fontSize: 11, fontFamily: fontFamilies.bodyRegular },
});
