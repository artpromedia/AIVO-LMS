import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "@/hooks/useTranslation";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { Card, Button } from "@/components/ui";
import {
  affirmationKeyFor,
  getCalmCatalog,
  recommendCalmActivity,
  type CalmActivity,
} from "@/lib/calm";
import { BoxBreathing } from "@/src/components/learner/calm/BoxBreathing";
import { PatternFocus } from "@/src/components/learner/calm/PatternFocus";
import { SortingCalm } from "@/src/components/learner/calm/SortingCalm";
import { spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

/** Persisted, explicit opt-in (default off) — the mobile analog of the web
 *  `calmAudioCues` accessibility preference. */
const AUDIO_PREF_KEY = "calm.audioCues";

/**
 * Calm Corner — a learner-initiated regulation surface (mobile parity for
 * the web `learner/calm`). Universal activities (breathing, grounding,
 * stretch, strategies, two calming games) are always available; a
 * personalized suggestion appears when a homework focus signal deep-links
 * via `?action=`. Affirmations are computed locally (pure) so the surface
 * works fully offline and never blocks the learner on a network call.
 */
export default function CalmCornerScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const params = useLocalSearchParams<{ action?: string }>();
  const catalog = getCalmCatalog();

  const [active, setActive] = useState<CalmActivity | null>(null);
  const [affirmation, setAffirmation] = useState<string | null>(null);
  const [audioCuesEnabled, setAudioCuesEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(AUDIO_PREF_KEY)
      .then((v) => {
        if (mounted && v === "true") setAudioCuesEnabled(true);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  const toggleAudio = useCallback((next: boolean) => {
    setAudioCuesEnabled(next);
    AsyncStorage.setItem(AUDIO_PREF_KEY, next ? "true" : "false").catch(() => undefined);
  }, []);

  const recommended = useMemo(() => {
    const action = typeof params.action === "string" ? params.action : null;
    if (!action) return null;
    const id = recommendCalmActivity(action);
    return catalog.find((a) => a.id === id) ?? null;
  }, [params.action, catalog]);

  // No calm BFF on mobile — the affirmation is the same pure mapping the web
  // server returns, so completion is instant and offline-safe.
  const complete = useCallback((activity: CalmActivity) => {
    setAffirmation(affirmationKeyFor(activity.id));
    setActive(null);
  }, []);

  if (affirmation) {
    return (
      <ResponsiveScreen maxWidth="dashboard" background={palette.bgPage}>
        <Header t={t} palette={palette} />
        <Card tone="raised" style={styles.affirmCard}>
          <Text style={styles.affirmEmoji} accessibilityElementsHidden>
            🌿
          </Text>
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.affirmText, { color: palette.ink }]}
          >
            {t(`learnerCalm.affirmations.${affirmation}`)}
          </Text>
          <Button
            title={t("learnerCalm.do_another")}
            onPress={() => setAffirmation(null)}
          />
        </Card>
      </ResponsiveScreen>
    );
  }

  if (active) {
    return (
      <ResponsiveScreen maxWidth="dashboard" background={palette.bgPage}>
        <Header t={t} palette={palette} />
        <ActivityRunner
          activity={active}
          audioCuesEnabled={audioCuesEnabled}
          onDone={() => complete(active)}
          onCancel={() => setActive(null)}
        />
      </ResponsiveScreen>
    );
  }

  return (
    <ResponsiveScreen maxWidth="dashboard" background={palette.bgPage}>
      <Header t={t} palette={palette} />
      <Text style={[styles.intro, { color: palette.inkMuted }]}>
        {t("learnerCalm.intro")}
      </Text>

      <View
        style={[styles.audioRow, { backgroundColor: palette.bgRaised, borderColor: palette.border }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.audioLabel, { color: palette.ink }]}>
            {t("learnerCalm.audio.label")}
          </Text>
          <Text style={[styles.audioState, { color: palette.inkMuted }]}>
            {audioCuesEnabled ? t("learnerCalm.audio.on") : t("learnerCalm.audio.off")}
          </Text>
        </View>
        <Switch
          value={audioCuesEnabled}
          onValueChange={toggleAudio}
          accessibilityLabel={t("learnerCalm.audio.label")}
        />
      </View>

      {recommended ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.ink }]}>
            {t("learnerCalm.suggested_title")}
          </Text>
          <ActivityCard
            activity={recommended}
            highlighted
            onPick={() => setActive(recommended)}
            t={t}
            palette={palette}
          />
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: palette.ink }]}>
          {t("learnerCalm.all_title")}
        </Text>
        <View style={styles.grid}>
          {catalog.map((a) => (
            <ActivityCard
              key={a.id}
              activity={a}
              onPick={() => setActive(a)}
              t={t}
              palette={palette}
            />
          ))}
        </View>
      </View>
    </ResponsiveScreen>
  );
}

type T = (key: string, defaultValueOrOptions?: string | Record<string, unknown>) => string;
type Palette = ReturnType<typeof useSensoryPalette>;

function Header({ t, palette }: { t: T; palette: Palette }) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel={t("common.back", "Back")}
        hitSlop={8}
        style={[styles.backBtn, { backgroundColor: palette.bgRaised, borderColor: palette.border }]}
      >
        <Ionicons name="chevron-back" size={22} color={palette.ink} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={[styles.eyebrow, { color: palette.inkMuted }]}>
          {t("learnerCalm.eyebrow")}
        </Text>
        <Text style={[styles.title, { color: palette.ink }]}>{t("learnerCalm.title")}</Text>
      </View>
    </View>
  );
}

function ActivityCard({
  activity,
  highlighted = false,
  onPick,
  t,
  palette,
}: {
  activity: CalmActivity;
  highlighted?: boolean;
  onPick: () => void;
  t: T;
  palette: Palette;
}) {
  return (
    <Pressable
      onPress={onPick}
      accessibilityRole="button"
      style={[
        styles.activityCard,
        {
          backgroundColor: highlighted ? palette.primary + "14" : palette.bgRaised,
          borderColor: highlighted ? palette.primary : palette.border,
        },
      ]}
    >
      <Text style={[styles.activityTitle, { color: palette.ink }]}>
        {t(`learnerCalm.activities.${activity.titleKey}`)}
      </Text>
      <Text style={[styles.activityBody, { color: palette.inkMuted }]}>
        {t(`learnerCalm.activities.${activity.bodyKey}`)}
      </Text>
    </Pressable>
  );
}

function ActivityRunner({
  activity,
  audioCuesEnabled,
  onDone,
  onCancel,
}: {
  activity: CalmActivity;
  audioCuesEnabled: boolean;
  onDone: (secondsSpent: number) => void;
  onCancel: () => void;
}) {
  if (activity.kind === "breathing") {
    return (
      <BoxBreathing audioCuesEnabled={audioCuesEnabled} onDone={onDone} onCancel={onCancel} />
    );
  }
  if (activity.id === "pattern_focus") {
    return <PatternFocus onDone={onDone} onCancel={onCancel} />;
  }
  if (activity.id === "sorting_calm") {
    return <SortingCalm onDone={onDone} onCancel={onCancel} />;
  }
  return <StaticActivity activity={activity} onDone={onDone} onCancel={onCancel} />;
}

function StaticActivity({
  activity,
  onDone,
  onCancel,
}: {
  activity: CalmActivity;
  onDone: (secondsSpent: number) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const [startedAt] = useState(() => Date.now());
  return (
    <Card tone="raised" style={styles.staticCard}>
      <Text style={[styles.activityTitle, { color: palette.ink, fontSize: 22 }]}>
        {t(`learnerCalm.activities.${activity.titleKey}`)}
      </Text>
      <Text style={[styles.activityBody, { color: palette.inkMuted, fontSize: 16 }]}>
        {t(`learnerCalm.activities.${activity.bodyKey}`)}
      </Text>
      <View style={styles.staticActions}>
        <Button
          title={t("learnerCalm.im_done")}
          onPress={() => onDone(Math.round((Date.now() - startedAt) / 1000))}
        />
        <Button variant="outline" title={t("learnerCalm.go_back")} onPress={onCancel} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
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
  eyebrow: {
    fontSize: 12,
    fontFamily: fontFamilies.bodyBold,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: { fontSize: 24, fontFamily: fontFamilies.displayBold },
  intro: { fontSize: 15, fontFamily: fontFamilies.bodyRegular, marginBottom: spacing.md },
  audioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  audioLabel: { fontSize: 15, fontFamily: fontFamilies.bodyBold },
  audioState: { fontSize: 13, fontFamily: fontFamilies.bodyRegular, marginTop: 2 },
  section: { marginBottom: spacing.lg, gap: spacing.sm },
  sectionTitle: { fontSize: 16, fontFamily: fontFamilies.bodyBold },
  grid: { gap: spacing.sm },
  activityCard: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  activityTitle: { fontSize: 15, fontFamily: fontFamilies.bodyBold },
  activityBody: { fontSize: 14, fontFamily: fontFamilies.bodyRegular, marginTop: 4 },
  affirmCard: {
    marginTop: spacing.lg,
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.xl,
  },
  affirmEmoji: { fontSize: 40 },
  affirmText: { fontSize: 22, fontFamily: fontFamilies.displayBold, textAlign: "center" },
  staticCard: { marginTop: spacing.lg, gap: spacing.md, padding: spacing.lg },
  staticActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
