import React, { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { useGradebook } from "@/hooks/useGradebook";
import { groupBySubject } from "@/lib/gradebook-logic";
import { Card } from "@/components/ui";
import { spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

/**
 * AI-style SMART-goal IEP draft generator (MOB-TCH-003) — mirror of
 * web's /teacher/learners/[learnerId]/iep/draft. Reads the learner's
 * gradebook, finds the lowest-scoring skills, and drafts SMART goals
 * (specific skill, current %, a +20pt target). Generation is local +
 * deterministic so it works without a server round-trip; teachers edit
 * before saving into the IEP.
 */
export function IepDraftCard({ learnerId }: { learnerId: string }) {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { data: gradebook } = useGradebook(learnerId);
  const [generated, setGenerated] = useState(false);

  const drafts = useMemo(() => {
    const skills = groupBySubject(gradebook ?? []).flatMap((g) =>
      g.skills.map((s) => ({ subject: g.subject, ...s })),
    );
    return skills
      .sort((a, b) => a.score - b.score)
      .slice(0, 4)
      .map((s) => {
        const cur = Math.round(s.score * 100);
        const target = Math.min(100, cur + 20);
        return {
          skill: s.skill,
          subject: s.subject,
          current: cur,
          target,
          text: t("teacherIepDraft.goalText", {
            skill: s.skill,
            target,
            defaultValue: `By the next review, the student will demonstrate ${s.skill} with at least ${target}% accuracy across 3 consecutive sessions.`,
          }),
        };
      });
  }, [gradebook, t]);

  return (
    <Card tone="raised" style={{ gap: spacing.sm }}>
      <View style={styles.head}>
        <Ionicons name="sparkles" size={20} color={palette.primary} />
        <Text style={[styles.title, { color: palette.ink }]}>
          {t("teacherIepDraft.title", "Draft SMART goals")}
        </Text>
      </View>
      <Text style={[styles.desc, { color: palette.inkMuted }]}>
        {t(
          "teacherIepDraft.desc",
          "Generate goal drafts from the lowest-scoring skills. Review and edit before adding to the IEP.",
        )}
      </Text>

      {!generated ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("teacherIepDraft.generate", "Generate drafts")}
          onPress={() => setGenerated(true)}
          style={[styles.cta, { backgroundColor: palette.primary }]}
        >
          <Ionicons name="create-outline" size={18} color="#fff" />
          <Text style={styles.ctaText}>{t("teacherIepDraft.generate", "Generate drafts")}</Text>
        </Pressable>
      ) : drafts.length === 0 ? (
        <Text style={[styles.desc, { color: palette.inkMuted }]}>
          {t("teacherIepDraft.noData", "No skill data yet to draft goals from.")}
        </Text>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {drafts.map((d, i) => (
            <View
              key={`${d.skill}-${i}`}
              style={[
                styles.goal,
                { borderColor: palette.border, backgroundColor: palette.bgPage },
              ]}
            >
              <Text style={[styles.goalSkill, { color: palette.ink }]}>
                {d.subject} · {d.skill}
              </Text>
              <Text style={[styles.goalMeta, { color: palette.inkMuted }]}>
                {t("teacherIepDraft.fromTo", {
                  cur: d.current,
                  target: d.target,
                  defaultValue: `${d.current}% → ${d.target}% target`,
                })}
              </Text>
              <Text style={[styles.goalText, { color: palette.ink }]}>{d.text}</Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 16, fontFamily: fontFamilies.displayBold },
  desc: { fontSize: 13, fontFamily: fontFamilies.bodyRegular, lineHeight: 19 },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.xl,
  },
  ctaText: { color: "#fff", fontSize: 15, fontFamily: fontFamilies.bodyBold },
  goal: { padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, gap: 4 },
  goalSkill: { fontSize: 14, fontFamily: fontFamilies.bodyBold },
  goalMeta: { fontSize: 12, fontFamily: fontFamilies.bodySemiBold },
  goalText: { fontSize: 14, fontFamily: fontFamilies.bodyRegular, lineHeight: 20, marginTop: 2 },
});
