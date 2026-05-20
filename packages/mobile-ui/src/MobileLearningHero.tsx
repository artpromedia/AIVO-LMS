import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { theme } from "./theme";

/**
 * Mobile/MobileLearningHero
 *
 * Sprint 18: greeting hero panel for the learner home, matching the
 * web's @aivo/ui/hero/LearningHero rhythm but tuned for mobile —
 * stacked layout, no fixed-pixel hero artwork.
 */
export interface MobileLearningHeroProps {
  greeting: string;
  subhead?: string;
  /** Optional emoji or decorative node for the companion slot. */
  companion?: React.ReactNode;
  /** Optional chip strip (small <View>s passed in). */
  chips?: React.ReactNode;
  /** Optional CTA row. */
  cta?: React.ReactNode;
}

export function MobileLearningHero({
  greeting,
  subhead,
  companion,
  chips,
  cta,
}: MobileLearningHeroProps) {
  return (
    <View style={styles.hero}>
      <View style={styles.row}>
        <View style={styles.textCol}>
          <Text style={styles.greeting}>{greeting}</Text>
          {subhead ? <Text style={styles.subhead}>{subhead}</Text> : null}
        </View>
        {companion ? <View style={styles.companion}>{companion}</View> : null}
      </View>
      {chips ? <View style={styles.chips}>{chips}</View> : null}
      {cta ? <View style={styles.cta}>{cta}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xxl,
    padding: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  row: { flexDirection: "row", alignItems: "center" },
  textCol: { flex: 1 },
  greeting: { fontSize: 26, fontWeight: "700", color: theme.colors.text },
  subhead: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginTop: 4,
    lineHeight: 22,
  },
  companion: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${theme.colors.primary}1A`,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: theme.spacing.md,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: theme.spacing.md,
  },
  cta: { marginTop: theme.spacing.md },
});
