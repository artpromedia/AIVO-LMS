import React, { useMemo, useState, useCallback } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "@/hooks/useTranslation";
import { useConnectedLearners } from "@/hooks/useFamily";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { Card } from "@/components/ui";
import { useBrainDomains } from "@/hooks/useBrain";
import { summarizeDomains } from "@/lib/learner-progress";
import {
  distribution,
  BAND_ORDER,
  BAND_LABEL,
  BAND_TONE,
  type LearnerMastery,
} from "@/lib/mastery-distribution";
import { spacing } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

interface Lite {
  id: string;
  gradeLevel?: string | null;
}

/**
 * Class/caseload mastery-distribution card. Each learner's overall
 * mastery (brain-svc) is collected via a fixed set of invisible probe
 * components (one per learner — a stable hook count), then aggregated
 * into a banded distribution + group average. Shared by teacher and
 * therapist reports.
 */
export function MasteryDistributionCard({ title }: { title?: string }) {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { data } = useConnectedLearners();
  const learners = (data as Lite[] | undefined) ?? [];

  const [overall, setOverall] = useState<Record<string, number>>({});
  const report = useCallback((id: string, value: number) => {
    setOverall((prev) => (prev[id] === value ? prev : { ...prev, [id]: value }));
  }, []);

  const masteries: LearnerMastery[] = learners
    .filter((l) => overall[l.id] !== undefined)
    .map((l) => ({ learnerId: l.id, overall: overall[l.id]! }));
  const dist = useMemo(() => distribution(masteries), [masteries]);

  return (
    <Card tone="raised" style={{ gap: spacing.sm }}>
      <Text style={[styles.title, { color: palette.ink }]}>
        {title ?? t("reports.distribution", "Mastery distribution")}
      </Text>

      {/* Invisible probes — one per learner, stable order ⇒ stable hooks. */}
      {learners.map((l) => (
        <MasteryProbe key={l.id} id={l.id} grade={l.gradeLevel ?? null} onValue={report} />
      ))}

      {learners.length === 0 ? (
        <Text style={[styles.empty, { color: palette.inkMuted }]}>
          {t("reports.noData", "No learners yet.")}
        </Text>
      ) : (
        <View style={{ gap: spacing.sm }}>
          <View style={styles.avgRow}>
            <Text style={[styles.avgValue, { color: palette.primary }]}>{dist.average}%</Text>
            <Text style={[styles.avgLabel, { color: palette.inkMuted }]}>
              {t("reports.average", {
                count: learners.length,
                defaultValue: `group average · ${learners.length} learners`,
              })}
            </Text>
          </View>
          {BAND_ORDER.map((band) => {
            const count = dist.bands[band];
            const w = dist.total === 0 ? 0 : Math.round((count / dist.total) * 100);
            return (
              <View key={band} style={styles.bandRow}>
                <Text style={[styles.bandLabel, { color: palette.ink }]}>
                  {t(`reports.band.${band}`, BAND_LABEL[band])}
                </Text>
                <View style={[styles.track, { backgroundColor: palette.bgPage }]}>
                  <View
                    style={[
                      styles.fill,
                      {
                        width: `${Math.max(count > 0 ? 6 : 0, w)}%`,
                        backgroundColor: BAND_TONE[band],
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.count, { color: palette.inkMuted }]}>{count}</Text>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}

/** Renders nothing; reports its learner's overall mastery to the parent. */
function MasteryProbe({
  id,
  grade,
  onValue,
}: {
  id: string;
  grade: string | null;
  onValue: (id: string, value: number) => void;
}) {
  const { domains } = useBrainDomains(id, { enrolledGrade: grade });
  const overall = useMemo(
    () =>
      summarizeDomains(domains.map((d) => ({ domain: d.domain, masteryPercent: d.masteryPercent })))
        .overallMastery,
    [domains],
  );
  React.useEffect(() => onValue(id, overall), [id, overall, onValue]);
  return null;
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontFamily: fontFamilies.displayBold },
  empty: { fontSize: 14, fontFamily: fontFamilies.bodyRegular },
  avgRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  avgValue: { fontSize: 28, fontFamily: fontFamilies.displayBold },
  avgLabel: { fontSize: 13, fontFamily: fontFamilies.bodyRegular },
  bandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  bandLabel: { width: 92, fontSize: 13, fontFamily: fontFamilies.bodySemiBold },
  track: { flex: 1, height: 14, borderRadius: 7, overflow: "hidden" },
  fill: { height: 14, borderRadius: 7 },
  count: { width: 20, textAlign: "right", fontSize: 13, fontFamily: fontFamilies.bodyBold },
});
