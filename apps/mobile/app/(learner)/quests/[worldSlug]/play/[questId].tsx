import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";
import { AivoCard } from "@aivo/mobile-ui";
import { colors, spacing, radius } from "@/constants/colors";

interface QuestWorld {
  key: string;
  name: string;
  tutorKey: string;
  subject: string;
  description: string;
  chapters: number;
}

interface BossQuestion {
  id: string;
  prompt: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
}

interface BossAssessment {
  questions: BossQuestion[];
  passingScore: number;
}

interface QuestChapter {
  id: string;
  worldKey: string;
  chapterNumber: number;
  title: string;
  description: string | null;
  narrativeIntro: string | null;
  narrativeOutro: string | null;
  xpReward: number | null;
  coinReward: number | null;
  bossAssessment: BossAssessment | null;
}

type Phase = "intro" | "play" | "outro";

interface CompletionResult {
  score: number;
  xpAwarded: number;
  coinAwarded: number;
  alreadyCompleted: boolean;
}

export default function QuestPlayScreen() {
  const { worldSlug, questId } = useLocalSearchParams<{
    worldSlug: string;
    questId: string;
  }>();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useAuth();

  const slug = String(worldSlug);
  const id = String(questId);

  const [world, setWorld] = useState<QuestWorld | null>(null);
  const [quest, setQuest] = useState<QuestChapter | null>(null);
  const [loadError, setLoadError] = useState<"not_found" | "mismatch" | "fetch" | null>(null);
  const [phase, setPhase] = useState<Phase>("intro");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [completion, setCompletion] = useState<CompletionResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user || !slug || !id) return;
    let cancelled = false;
    (async () => {
      try {
        const [wr, cr] = await Promise.all([
          apiFetch(API.ENGAGEMENT, `/api/engagement/quests/worlds/${encodeURIComponent(slug)}`),
          apiFetch(API.ENGAGEMENT, `/api/engagement/quests/chapter/${encodeURIComponent(id)}`),
        ]);
        if (cancelled) return;
        if (wr.status === 404 || cr.status === 404) {
          setLoadError("not_found");
          return;
        }
        if (!wr.ok || !cr.ok) {
          setLoadError("fetch");
          return;
        }
        const resolvedWorld: QuestWorld = await wr.json();
        const body = await cr.json();
        const resolvedQuest: QuestChapter = body.quest;
        if (resolvedQuest.worldKey !== resolvedWorld.key) {
          setLoadError("mismatch");
          return;
        }
        setWorld(resolvedWorld);
        setQuest(resolvedQuest);
      } catch {
        if (!cancelled) setLoadError("fetch");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user, slug, id]);

  const questions = useMemo<BossQuestion[]>(() => quest?.bossAssessment?.questions ?? [], [quest]);

  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id] !== undefined);
  const score = useMemo(() => {
    if (questions.length === 0) return 0;
    const correct = questions.reduce(
      (acc, q) => acc + (answers[q.id] === q.answerIndex ? 1 : 0),
      0,
    );
    return Math.round((correct / questions.length) * 100);
  }, [questions, answers]);

  async function submitCompletion() {
    if (!user || !quest) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(API.ENGAGEMENT, "/api/engagement/quests/complete", {
        method: "POST",
        body: JSON.stringify({ learnerId: user.id, questId: quest.id, score }),
      });
      if (res.ok) {
        const body = await res.json();
        setCompletion({
          score: body.score ?? score,
          xpAwarded: body.xpAwarded ?? 0,
          coinAwarded: body.coinAwarded ?? 0,
          alreadyCompleted: !!body.alreadyCompleted,
        });
        setPhase("outro");
      } else {
        setLoadError("fetch");
      }
    } catch {
      setLoadError("fetch");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backRow}>
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.notFoundTitle}>Quest world not found</Text>
        <Text style={styles.notFoundSlug}>
          {slug}/{id}
        </Text>
      </View>
    );
  }

  if (!world || !quest) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32 }}
    >
      <Pressable accessibilityRole="button"
        onPress={() => router.push(`/(learner)/quests/${world.key}` as any)}
        style={styles.backRow}
      >
        <Ionicons name="arrow-back" size={20} color={colors.primary} />
        <Text style={styles.backText}>{world.name}</Text>
      </Pressable>
      <Text style={styles.title}>{quest.title}</Text>
      <Text style={styles.subtitle}>
        {world.subject} · Chapter {quest.chapterNumber}
      </Text>

      {phase === "intro" && (
        <AivoCard style={styles.introCard}>
          <Text style={styles.introBody}>{quest.narrativeIntro ?? quest.description ?? ""}</Text>
          <Pressable accessibilityRole="button" onPress={() => setPhase("play")} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Begin →</Text>
          </Pressable>
        </AivoCard>
      )}

      {phase === "play" &&
        questions.map((q, idx) => {
          const chosen = answers[q.id];
          const isRevealed = revealed[q.id];
          return (
            <AivoCard key={q.id} style={styles.questionCard}>
              <Text style={styles.questionMeta}>
                Question {idx + 1} of {questions.length}
              </Text>
              <Text style={styles.questionPrompt}>{q.prompt}</Text>
              {q.choices.map((choice, choiceIdx) => {
                const selected = chosen === choiceIdx;
                const correct = q.answerIndex === choiceIdx;
                const showState = isRevealed && (selected || correct);
                let borderColor = colors.border;
                let bg = "#fff";
                if (showState && correct) {
                  borderColor = "#16a34a";
                  bg = "#dcfce7";
                } else if (showState && !correct && selected) {
                  borderColor = "#dc2626";
                  bg = "#fee2e2";
                } else if (selected) {
                  borderColor = colors.primary;
                  bg = "#eef2ff";
                }
                return (
                  <Pressable
                    key={choiceIdx}
                    disabled={isRevealed}
                    onPress={() => {
                      setAnswers((a) => ({ ...a, [q.id]: choiceIdx }));
                      setRevealed((r) => ({ ...r, [q.id]: true }));
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[styles.choice, { borderColor, backgroundColor: bg }]}
                  >
                    <Text style={styles.choiceText}>{choice}</Text>
                  </Pressable>
                );
              })}
              {isRevealed && (
                <Text style={styles.explanation}>
                  <Text style={{ fontFamily: "Nunito-Bold" }}>
                    {answers[q.id] === q.answerIndex ? "Correct! " : "Not quite. "}
                  </Text>
                  {q.explanation}
                </Text>
              )}
            </AivoCard>
          );
        })}

      {phase === "play" && (
        <View style={styles.finishRow}>
          <View>
            <Text style={styles.finishLabel}>Score</Text>
            <Text style={styles.finishValue}>{allAnswered ? `${score}%` : "—"}</Text>
          </View>
          <Pressable accessibilityRole="button"
            disabled={!allAnswered || submitting}
            onPress={submitCompletion}
            style={[styles.primaryButton, (!allAnswered || submitting) && { opacity: 0.5 }]}
          >
            <Text style={styles.primaryButtonText}>{submitting ? "Saving…" : "Finish quest"}</Text>
          </Pressable>
        </View>
      )}

      {phase === "outro" && completion && (
        <AivoCard style={styles.outroCard}>
          <View style={styles.celebrateRow}>
            <Ionicons name="sparkles" size={18} color="#fff" />
            <Text style={styles.celebrateLabel}>Chapter complete</Text>
          </View>
          <Text style={styles.outroScore}>{completion.score}%</Text>
          <Text style={styles.outroBody}>
            {quest.narrativeOutro ?? `You finished ${quest.title}!`}
          </Text>
          <View style={styles.rewardRow}>
            <View>
              <Text style={styles.rewardValue}>+{completion.xpAwarded}</Text>
              <Text style={styles.rewardLabel}>XP</Text>
            </View>
            <View>
              <Text style={styles.rewardValue}>+{completion.coinAwarded}</Text>
              <Text style={styles.rewardLabel}>coins</Text>
            </View>
          </View>
          {completion.alreadyCompleted ? (
            <Text style={styles.alreadyText}>
              You finished this chapter before — rewards were not granted again.
            </Text>
          ) : null}
          <Pressable accessibilityRole="button"
            onPress={() => router.push(`/(learner)/quests/${world.key}` as any)}
            style={styles.outroButton}
          >
            <Text style={styles.outroButtonText}>Back to {world.name}</Text>
          </Pressable>
        </AivoCard>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  backRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md },
  backText: { fontSize: 16, fontFamily: "Nunito-SemiBold", color: colors.primary },
  title: { fontSize: 22, fontFamily: "Nunito-ExtraBold", color: colors.text },
  subtitle: {
    fontSize: 12,
    fontFamily: "Nunito-Bold",
    color: "#6366f1",
    textTransform: "uppercase",
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  introCard: { padding: spacing.md, gap: spacing.md },
  introBody: { fontSize: 15, fontFamily: "Nunito-Regular", color: colors.text, lineHeight: 22 },
  questionCard: { padding: spacing.md, marginBottom: spacing.sm, gap: spacing.xs },
  questionMeta: {
    fontSize: 11,
    fontFamily: "Nunito-Bold",
    color: colors.textSecondary,
    textTransform: "uppercase",
  },
  questionPrompt: {
    fontSize: 15,
    fontFamily: "Nunito-Bold",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  choice: {
    borderWidth: 2,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginBottom: spacing.xs,
    minHeight: 44,
    justifyContent: "center",
  },
  choiceText: { fontSize: 14, fontFamily: "Nunito-SemiBold", color: colors.text },
  explanation: {
    fontSize: 13,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  finishRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    backgroundColor: "#fff",
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    marginTop: spacing.sm,
  },
  finishLabel: {
    fontSize: 11,
    fontFamily: "Nunito-Bold",
    color: colors.textSecondary,
    textTransform: "uppercase",
  },
  finishValue: { fontSize: 22, fontFamily: "Nunito-ExtraBold", color: colors.text },
  primaryButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryButtonText: { color: "#fff", fontFamily: "Nunito-Bold", fontSize: 14 },
  outroCard: { padding: spacing.lg, backgroundColor: "#4f46e5", gap: spacing.sm },
  celebrateRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  celebrateLabel: {
    color: "#fff",
    fontFamily: "Nunito-Bold",
    fontSize: 12,
    textTransform: "uppercase",
  },
  outroScore: { color: "#fff", fontSize: 32, fontFamily: "Nunito-ExtraBold" },
  outroBody: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    lineHeight: 20,
  },
  rewardRow: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.sm },
  rewardValue: { color: "#fff", fontSize: 20, fontFamily: "Nunito-ExtraBold" },
  rewardLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontFamily: "Nunito-Bold",
    textTransform: "uppercase",
  },
  alreadyText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontFamily: "Nunito-Regular",
    marginTop: spacing.xs,
  },
  outroButton: {
    marginTop: spacing.md,
    backgroundColor: "#fff",
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.lg,
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
  },
  outroButtonText: { color: "#4f46e5", fontFamily: "Nunito-Bold", fontSize: 14 },
  notFoundTitle: {
    fontSize: 20,
    fontFamily: "Nunito-ExtraBold",
    color: colors.text,
    marginTop: spacing.xl,
  },
  notFoundSlug: {
    fontSize: 13,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
