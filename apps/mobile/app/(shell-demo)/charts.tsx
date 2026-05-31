import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  AivoCard,
  MasteryBar,
  TrendChart,
  DotChart,
  MasteryHeatStrip,
  ConfidenceMeter,
  useResponsiveLayout,
  useColumns,
  theme,
  type ChartPoint,
  type MasteryCell,
} from "@aivo/mobile-ui";

/**
 * Chart-kit gallery (Phase 0 foundation). Renders every primitive from
 * `@aivo/mobile-ui/charts` with sample data so the kit can be eyeballed
 * on phone and tablet — the `(shell-demo)` group is a non-shipping
 * preview surface. Reachable at `/(shell-demo)/charts`.
 */

const LESSONS_BY_DAY: ChartPoint[] = [
  { label: "M", value: 2 },
  { label: "T", value: 4 },
  { label: "W", value: 3 },
  { label: "T", value: 6 },
  { label: "F", value: 5 },
  { label: "S", value: 1 },
  { label: "S", value: 0 },
];

const SESSIONS: ChartPoint[] = [
  { label: "W1", value: 5 },
  { label: "W2", value: 8 },
  { label: "W3", value: 6 },
  { label: "W4", value: 11 },
  { label: "W5", value: 9 },
  { label: "W6", value: 14 },
];

const SKILL_CELLS: MasteryCell[] = [
  { code: "RL.3.1", level: "mastered" },
  { code: "RL.3.2", level: "proficient" },
  { code: "RL.3.3", level: "proficient" },
  { code: "RF.3.4", level: "developing" },
  { code: "L.3.1", level: "developing" },
  { code: "L.3.2", level: "emerging" },
  { code: "W.3.1", level: "proficient" },
  { code: "W.3.2", level: "mastered" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <AivoCard style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </AivoCard>
  );
}

export default function ChartGalleryScreen() {
  const router = useRouter();
  const { isTablet, contentMaxWidth } = useResponsiveLayout();
  const cols = useColumns({ compact: 1, medium: 2, expanded: 2 });

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={[styles.content, { maxWidth: contentMaxWidth, alignSelf: "center" }]}
      >
        <Text style={styles.h1}>Chart kit</Text>
        <Text style={styles.sub}>
          @aivo/mobile-ui · {isTablet ? "tablet" : "phone"} layout · {cols}-up grid
        </Text>

        <Section title="MasteryBar">
          <View style={{ gap: 14 }}>
            <MasteryBar label="Math" value={0.82} caption="On grade level" />
            <MasteryBar label="Reading" value={64} caption="Approaching" />
            <MasteryBar label="Science" value={0.28} caption="Emerging" />
          </View>
        </Section>

        <View style={[styles.row, { flexDirection: cols === 1 ? "column" : "row" }]}>
          <View style={styles.rowItem}>
            <Section title="TrendChart — lessons / day">
              <TrendChart data={LESSONS_BY_DAY} ariaLabel="Lessons completed per day" />
            </Section>
          </View>
          <View style={styles.rowItem}>
            <Section title="DotChart — sessions / week">
              <DotChart data={SESSIONS} tone={theme.colors.accent} ariaLabel="Sessions per week" />
            </Section>
          </View>
        </View>

        <Section title="MasteryHeatStrip — skills">
          <MasteryHeatStrip cells={SKILL_CELLS} />
        </Section>

        <Section title="ConfidenceMeter">
          <View style={{ gap: 12 }}>
            <ConfidenceMeter label="Model confidence" value={0.8} />
            <ConfidenceMeter label="Low confidence" value={0.3} tone={theme.colors.warning} />
          </View>
        </Section>

        <Section title="States">
          <View style={{ gap: 12 }}>
            <TrendChart data={[]} loading height={80} />
            <TrendChart data={[]} empty height={80} />
            <TrendChart data={[]} error="Couldn't load trend" height={80} />
          </View>
        </Section>

        <Text onPress={() => router.back()} style={styles.back}>
          ← Back
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, gap: theme.spacing.md, width: "100%" },
  h1: { fontSize: 26, fontFamily: theme.fonts.heading, color: theme.colors.text },
  sub: {
    fontSize: 13,
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  section: { gap: theme.spacing.md },
  sectionTitle: { fontSize: 15, fontFamily: theme.fonts.bodyBold, color: theme.colors.text },
  row: { gap: theme.spacing.md },
  rowItem: { flex: 1 },
  back: {
    fontSize: 15,
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.primary,
    paddingVertical: theme.spacing.md,
  },
});
