import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { Card, Button } from "@/components/ui";
import { spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

/**
 * Learner adaptive baseline runner (MOB-LRN-005) — mirror of web's
 * /learner/baseline/[baselineId]. Calm question flow with progress dots,
 * a break cadence, supports banner, and a completion hero. (The IRT/
 * streaming item source plugs into the same screen via assessment-svc.)
 */
const SAMPLE = [
  { q: "Which is larger: 24 or 42?", a: ["24", "42", "Same"] },
  { q: "Pick the word that rhymes with 'cat'.", a: ["dog", "hat", "sun"] },
  { q: "What is 5 + 7?", a: ["11", "12", "13"] },
  { q: "Which is a living thing?", a: ["Rock", "Tree", "Cup"] },
  { q: "Choose the capital letter.", a: ["b", "G", "m"] },
];
const BREAK_EVERY = 3;

export default function LearnerBaselineRunScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const [i, setI] = useState(0);
  const [onBreak, setOnBreak] = useState(false);
  const [done, setDone] = useState(false);

  const answer = () => {
    const nextIdx = i + 1;
    if (nextIdx >= SAMPLE.length) return setDone(true);
    if (nextIdx % BREAK_EVERY === 0) setOnBreak(true);
    setI(nextIdx);
  };

  if (done) {
    return (
      <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
        <Card tone="hero" style={[styles.card, { alignItems: "center", marginTop: spacing.xl }]}>
          <View style={[styles.iconWrap, { backgroundColor: "#22c55e1A" }]}>
            <Ionicons name="checkmark-circle" size={34} color="#22c55e" />
          </View>
          <Text style={[styles.h1, { color: palette.ink, textAlign: "center" }]}>{t("baselineRun.doneTitle", "Great work!")}</Text>
          <Text style={[styles.body, { color: palette.inkMuted, textAlign: "center" }]}>
            {t("baselineRun.doneBody", "You finished your baseline. AIVO will use this to build your learning plan.")}
          </Text>
          <Button title={t("baselineRun.finish", "Finish")} onPress={() => router.replace("/(learner)" as never)} fullWidth size="lg" style={{ marginTop: spacing.md }} />
        </Card>
      </ResponsiveScreen>
    );
  }

  if (onBreak) {
    return (
      <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
        <Card tone="hero" style={[styles.card, { alignItems: "center", marginTop: spacing.xl }]}>
          <View style={[styles.iconWrap, { backgroundColor: palette.accentSoft }]}>
            <Ionicons name="cafe" size={30} color={palette.accent} />
          </View>
          <Text style={[styles.h1, { color: palette.ink }]}>{t("baselineRun.breakTitle", "Take a breath")}</Text>
          <Text style={[styles.body, { color: palette.inkMuted, textAlign: "center" }]}>
            {t("baselineRun.breakBody", "Stretch, sip some water, and continue when you're ready.")}
          </Text>
          <Button title={t("baselineRun.continue", "Keep going")} onPress={() => setOnBreak(false)} fullWidth size="lg" style={{ marginTop: spacing.md }} />
        </Card>
      </ResponsiveScreen>
    );
  }

  const item = SAMPLE[i];
  return (
    <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
      <View style={[styles.supports, { backgroundColor: palette.accentSoft }]}>
        <Ionicons name="volume-high" size={16} color={palette.accent} />
        <Text style={[styles.supportsText, { color: palette.ink }]}>
          {t("baselineRun.supports", "Read-aloud + extra time are on")}
        </Text>
      </View>
      <View style={styles.dots}>
        {SAMPLE.map((_, idx) => (
          <View key={idx} style={[styles.dot, { backgroundColor: idx <= i ? palette.primary : palette.border, width: idx === i ? 22 : 8 }]} />
        ))}
      </View>
      <Card tone="raised" style={[styles.card, { marginTop: spacing.md }]}>
        <Text style={[styles.count, { color: palette.inkMuted }]}>
          {t("baselineRun.progress", { n: i + 1, total: SAMPLE.length, defaultValue: `Question ${i + 1} of ${SAMPLE.length}` })}
        </Text>
        <Text style={[styles.question, { color: palette.ink }]}>{item.q}</Text>
        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          {item.a.map((opt) => (
            <Pressable key={opt} accessibilityRole="button" accessibilityLabel={opt} onPress={answer}
              style={[styles.option, { borderColor: palette.border, backgroundColor: palette.bgPage }]}>
              <Text style={[styles.optionText, { color: palette.ink }]}>{opt}</Text>
            </Pressable>
          ))}
        </View>
      </Card>
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  supports: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full, alignSelf: "flex-start" },
  supportsText: { fontSize: 12, fontFamily: fontFamilies.bodySemiBold },
  dots: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.md },
  dot: { height: 8, borderRadius: 4 },
  card: { gap: spacing.sm },
  iconWrap: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  h1: { fontSize: 22, fontFamily: fontFamilies.displayBold },
  body: { fontSize: 14, fontFamily: fontFamilies.bodyRegular, lineHeight: 21 },
  count: { fontSize: 12, fontFamily: fontFamilies.bodyBold, textTransform: "uppercase", letterSpacing: 0.5 },
  question: { fontSize: 19, fontFamily: fontFamilies.displayBold, lineHeight: 26 },
  option: { paddingVertical: 14, paddingHorizontal: spacing.md, borderRadius: radius.lg, borderWidth: 1.5 },
  optionText: { fontSize: 16, fontFamily: fontFamilies.bodyBold },
});
