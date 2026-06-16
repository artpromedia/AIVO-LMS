import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { useConnectedLearners } from "@/hooks/useFamily";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";
import { AivoCard, AivoButton, EmptyState } from "@aivo/mobile-ui";
import { colors, spacing, radius } from "@/constants/colors";

const SUBJECTS = [
  "Mathematics",
  "English Language Arts",
  "Science",
  "History & Social Studies",
  "Coding & Computer Science",
  "Speech & Language",
  "Social-Emotional Learning",
];
const GRADE_LEVELS = [
  "Pre-K",
  "Kindergarten",
  "1st Grade",
  "2nd Grade",
  "3rd Grade",
  "4th Grade",
  "5th Grade",
  "6th Grade",
  "7th Grade",
  "8th Grade",
];

interface LessonPlanContent {
  objective?: string;
  overview?: string;
  standards?: string[];
  materials?: string[];
  duration?: string;
  differentiationGroups?: { level: string; modifications: string }[];
}

interface LessonPlanActivity {
  name: string;
  description: string;
  duration: string;
  materials?: string[];
  differentiationTips?: string;
}

interface LessonPlan {
  id: string;
  learnerId: string;
  title: string;
  subject: string;
  gradeLevel?: string;
  status: string;
  content?: LessonPlanContent;
  activities?: LessonPlanActivity[];
  accommodations?: { type: string; description: string }[];
  createdAt: string;
}

interface ConnectedLearner {
  id: string;
  name: string;
  functioningLevel: string | null;
  gradeLevel: string | null;
}

export default function LessonPlanScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { data: learnersRaw } = useConnectedLearners();
  const learners: ConnectedLearner[] = useMemo(
    () => (Array.isArray(learnersRaw) ? learnersRaw : []),
    [learnersRaw],
  );

  const [selectedLearnerId, setSelectedLearnerId] = useState<string>("");
  const [subject, setSubject] = useState("Mathematics");
  const [gradeLevel, setGradeLevel] = useState("3rd Grade");
  const [topic, setTopic] = useState("");
  const [accommodationNotes, setAccommodationNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<LessonPlan | null>(null);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);

  // Default the picker to the first connected learner once they load.
  useEffect(() => {
    if (!selectedLearnerId && learners.length > 0) {
      setSelectedLearnerId(learners[0].id);
    }
  }, [learners, selectedLearnerId]);

  const selectedLearner = useMemo(
    () => learners.find((l) => l.id === selectedLearnerId) || null,
    [learners, selectedLearnerId],
  );
  const getLearnerName = (id: string) => learners.find((l) => l.id === id)?.name || "Unknown";

  const { data: recentPlans, refetch: refetchPlans } = useQuery<LessonPlan[]>({
    queryKey: ["lesson-plans", user?.id],
    queryFn: async () => {
      const res = await apiFetch(API.ENGAGEMENT, "/api/engagement/lesson-plans/teacher");
      if (!res.ok) throw new Error("Failed to fetch plans");
      return res.json();
    },
    enabled: !!user?.id,
  });

  const handleGenerate = useCallback(async () => {
    if (!selectedLearnerId) {
      Alert.alert(t("common.error"), t("teacherLessonPlan.noLearnerError"));
      return;
    }
    setGenerating(true);
    setGeneratedPlan(null);
    try {
      const res = await apiFetch(API.ENGAGEMENT, "/api/engagement/lesson-plans/generate", {
        method: "POST",
        body: JSON.stringify({
          learnerId: selectedLearnerId,
          subject,
          gradeLevel: gradeLevel || selectedLearner?.gradeLevel || "3rd",
          topic: topic.trim() || undefined,
          functioningLevel: selectedLearner?.functioningLevel || undefined,
          accommodationNotes: accommodationNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setGeneratedPlan(data);
        refetchPlans();
      } else {
        Alert.alert(t("common.error"), data.error || t("teacherLessonPlan.generateError"));
      }
    } catch {
      Alert.alert(t("common.error"), t("teacherLessonPlan.networkError"));
    } finally {
      setGenerating(false);
    }
  }, [
    selectedLearnerId,
    selectedLearner,
    subject,
    gradeLevel,
    topic,
    accommodationNotes,
    t,
    refetchPlans,
  ]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32 }}
    >
      <Text style={styles.title}>{t("teacherLessonPlan.title")}</Text>
      <Text style={styles.subtitle}>{t("teacherLessonPlan.subtitle")}</Text>

      <AivoCard style={styles.genCard}>
        <Ionicons name="sparkles" size={32} color={colors.primary} />
        <Text style={styles.genTitle}>{t("teacherLessonPlan.generateNew")}</Text>
        <Text style={styles.genDesc}>{t("teacherLessonPlan.generateDesc")}</Text>

        <View style={styles.formSection}>
          <Text style={styles.fieldLabel}>{t("teacherLessonPlan.learner")}</Text>
          {learners.length === 0 ? (
            <Text style={[styles.genDesc, { textAlign: "left", marginBottom: 12 }]}>
              {t("teacherLessonPlan.noLearnersHint")}
            </Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 12 }}
            >
              {learners.map((l) => {
                const active = l.id === selectedLearnerId;
                return (
                  <Pressable
                    key={l.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setSelectedLearnerId(l.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {l.name}
                      {l.functioningLevel ? ` (${l.functioningLevel})` : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <Text style={styles.fieldLabel}>Subject</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 12 }}
          >
            {SUBJECTS.map((s) => (
              <Pressable accessibilityRole="button"
                key={s}
                style={[styles.chip, subject === s && styles.chipActive]}
                onPress={() => setSubject(s)}
              >
                <Text style={[styles.chipText, subject === s && styles.chipTextActive]}>{s}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>Grade Level</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 12 }}
          >
            {GRADE_LEVELS.map((g) => (
              <Pressable accessibilityRole="button"
                key={g}
                style={[styles.chip, gradeLevel === g && styles.chipActive]}
                onPress={() => setGradeLevel(g)}
              >
                <Text style={[styles.chipText, gradeLevel === g && styles.chipTextActive]}>
                  {g}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>Topic (optional)</Text>
          <TextInput accessibilityLabel="e.g. Fractions, Photosynthesis..."
            style={styles.input}
            value={topic}
            onChangeText={setTopic}
            placeholder="e.g. Fractions, Photosynthesis..."
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={styles.fieldLabel}>Accommodation Notes (optional)</Text>
          <TextInput accessibilityLabel="Any special needs or accommodations..."
            style={[styles.input, { height: 60 }]}
            value={accommodationNotes}
            onChangeText={setAccommodationNotes}
            placeholder="Any special needs or accommodations..."
            placeholderTextColor={colors.textSecondary}
            multiline
          />
        </View>

        {generating ? (
          <View style={{ alignItems: "center", marginTop: spacing.md }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.genDesc, { marginTop: 8 }]}>
              Generating lesson plan with AI...
            </Text>
          </View>
        ) : (
          <AivoButton
            title={t("teacherLessonPlan.createPlan")}
            onPress={handleGenerate}
            style={{ marginTop: spacing.md }}
          />
        )}
      </AivoCard>

      {generatedPlan && (
        <AivoCard style={{ marginBottom: spacing.lg, borderWidth: 2, borderColor: colors.success }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.genTitle}>Plan Generated!</Text>
          </View>
          <Text
            style={{ fontSize: 16, fontFamily: "Nunito-Bold", color: colors.text, marginBottom: 4 }}
          >
            {generatedPlan.title}
          </Text>
          {generatedPlan.content && (
            <>
              {generatedPlan.content.objective && (
                <View style={{ marginBottom: 8 }}>
                  <Text style={styles.fieldLabel}>Objective</Text>
                  <Text style={{ fontSize: 13, fontFamily: "Nunito-Regular", color: colors.text }}>
                    {generatedPlan.content.objective}
                  </Text>
                </View>
              )}
              {generatedPlan.content.duration && (
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: "Nunito-SemiBold",
                    color: colors.textSecondary,
                  }}
                >
                  Duration: {generatedPlan.content.duration}
                </Text>
              )}
            </>
          )}
          {Array.isArray(generatedPlan.activities) && generatedPlan.activities.length > 0 && (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.fieldLabel}>Activities ({generatedPlan.activities.length})</Text>
              {generatedPlan.activities.map((a, i) => (
                <Text
                  key={i}
                  style={{
                    fontSize: 12,
                    fontFamily: "Nunito-Regular",
                    color: colors.text,
                    marginLeft: 8,
                  }}
                >
                  • {a.name}: {a.duration}
                </Text>
              ))}
            </View>
          )}
        </AivoCard>
      )}

      <Text style={[styles.sectionTitle, { marginBottom: spacing.md }]}>
        {t("teacherLessonPlan.recentPlans")}
      </Text>
      {recentPlans && recentPlans.length > 0 ? (
        recentPlans.map((plan) => {
          const expanded = expandedPlanId === plan.id;
          return (
            <AivoCard key={plan.id} style={{ marginBottom: spacing.sm }}>
              <Pressable
                onPress={() => setExpandedPlanId(expanded ? null : plan.id)}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                style={styles.planHeader}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.planTitle}>{plan.title}</Text>
                  <Text style={styles.planMeta}>
                    {getLearnerName(plan.learnerId)} • {plan.subject} •{" "}
                    {new Date(plan.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        (plan.status === "DRAFT" ? colors.accent : colors.success) + "22",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      { color: plan.status === "DRAFT" ? colors.accent : colors.success },
                    ]}
                  >
                    {plan.status}
                  </Text>
                </View>
                <Ionicons
                  name={expanded ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.textSecondary}
                  style={{ marginLeft: 6 }}
                />
              </Pressable>

              {expanded && (
                <View style={styles.planDetails}>
                  {plan.content?.objective && (
                    <View style={styles.detailBlock}>
                      <Text style={styles.detailLabel}>{t("teacherLessonPlan.objective")}</Text>
                      <Text style={styles.detailText}>{plan.content.objective}</Text>
                    </View>
                  )}
                  {plan.content?.overview && (
                    <View style={styles.detailBlock}>
                      <Text style={styles.detailLabel}>{t("teacherLessonPlan.overview")}</Text>
                      <Text style={styles.detailText}>{plan.content.overview}</Text>
                    </View>
                  )}
                  {plan.content?.duration && (
                    <View style={styles.detailBlock}>
                      <Text style={styles.detailLabel}>{t("teacherLessonPlan.duration")}</Text>
                      <Text style={styles.detailText}>{plan.content.duration}</Text>
                    </View>
                  )}

                  {Array.isArray(plan.activities) && plan.activities.length > 0 && (
                    <View style={styles.detailBlock}>
                      <Text style={styles.detailLabel}>
                        {t("teacherLessonPlan.activities")} ({plan.activities.length})
                      </Text>
                      {plan.activities.map((a, i) => (
                        <View key={i} style={styles.activityItem}>
                          <Text style={styles.activityName}>
                            {a.name || `${t("teacherLessonPlan.activities")} ${i + 1}`}
                          </Text>
                          {a.description ? (
                            <Text style={styles.activityDesc}>{a.description}</Text>
                          ) : null}
                          {a.duration ? (
                            <Text style={styles.activityDuration}>{a.duration}</Text>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  )}

                  {Array.isArray(plan.accommodations) && plan.accommodations.length > 0 && (
                    <View style={styles.detailBlock}>
                      <Text style={styles.detailLabel}>
                        {t("teacherLessonPlan.accommodations")}
                      </Text>
                      {plan.accommodations.map((a, i) => (
                        <Text key={i} style={styles.accommodationLine}>
                          <Text style={styles.accommodationType}>
                            {a.type ? `${a.type}: ` : ""}
                          </Text>
                          {a.description || ""}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </AivoCard>
          );
        })
      ) : (
        <EmptyState
          icon={<Ionicons name="document-text-outline" size={48} color={colors.textSecondary} />}
          title={t("teacherLessonPlan.noPlansTitle")}
          message={t("teacherLessonPlan.noPlansMessage")}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  title: { fontSize: 24, fontFamily: "Nunito-ExtraBold", color: colors.text },
  subtitle: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  genCard: { alignItems: "center" as const, paddingVertical: spacing.lg, marginBottom: spacing.lg },
  genTitle: { fontSize: 18, fontFamily: "Nunito-Bold", color: colors.text, marginTop: 8 },
  genDesc: {
    fontSize: 13,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
  },
  sectionTitle: { fontSize: 18, fontFamily: "Nunito-Bold", color: colors.text },
  formSection: { width: "100%", marginTop: spacing.md },
  fieldLabel: {
    fontSize: 13,
    fontFamily: "Nunito-Bold",
    color: colors.textSecondary,
    marginBottom: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    marginRight: 6,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 12, fontFamily: "Nunito-SemiBold", color: colors.textSecondary },
  chipTextActive: { color: colors.white },
  input: {
    height: 40,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.text,
    marginBottom: 12,
  },
  planHeader: { flexDirection: "row", alignItems: "center" },
  planTitle: { fontSize: 15, fontFamily: "Nunito-Bold", color: colors.text },
  planMeta: {
    fontSize: 12,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    marginLeft: 8,
  },
  statusBadgeText: { fontSize: 11, fontFamily: "Nunito-Bold", textTransform: "uppercase" },
  planDetails: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailBlock: { marginBottom: spacing.sm },
  detailLabel: {
    fontSize: 12,
    fontFamily: "Nunito-Bold",
    color: colors.textSecondary,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  detailText: { fontSize: 13, fontFamily: "Nunito-Regular", color: colors.text },
  activityItem: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: 6,
  },
  activityName: { fontSize: 13, fontFamily: "Nunito-SemiBold", color: colors.text },
  activityDesc: {
    fontSize: 12,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginTop: 2,
  },
  activityDuration: {
    fontSize: 11,
    fontFamily: "Nunito-SemiBold",
    color: colors.primary,
    marginTop: 4,
  },
  accommodationLine: {
    fontSize: 13,
    fontFamily: "Nunito-Regular",
    color: colors.text,
    marginTop: 4,
  },
  accommodationType: { fontFamily: "Nunito-Bold" },
});
