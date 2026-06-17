import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";
import { Card } from "@/components/ui";
import { colors, spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

interface QuestWorld {
  key: string;
  name: string;
  tutorKey: string;
  subject: string;
  description: string;
  chapters: number;
}

interface QuestRow {
  id: string;
  worldKey: string;
  chapterNumber: number;
  title: string;
  description: string | null;
  narrativeIntro: string | null;
  xpReward: number | null;
  coinReward: number | null;
}

interface QuestProgress {
  questId: string;
  status: string;
  score: number | null;
}

type UiStatus = "completed" | "in_progress" | "available" | "locked";

function deriveStatus(
  q: QuestRow,
  progressMap: Map<string, QuestProgress>,
  prevCompleted: boolean,
): UiStatus {
  const p = progressMap.get(q.id);
  if (p?.status === "COMPLETED") return "completed";
  if (p?.status === "IN_PROGRESS") return "in_progress";
  if (q.chapterNumber <= 1 || prevCompleted) return "available";
  return "locked";
}

export default function QuestWorldScreen() {
  const { worldSlug } = useLocalSearchParams<{ worldSlug: string }>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();

  const [world, setWorld] = useState<QuestWorld | null>(null);
  const [worldStatus, setWorldStatus] = useState<"loading" | "found" | "not_found" | "error">(
    "loading",
  );
  const [chapters, setChapters] = useState<QuestRow[]>([]);
  const [progress, setProgress] = useState<QuestProgress[]>([]);
  const [starting, setStarting] = useState<string | null>(null);

  const slug = String(worldSlug);

  useEffect(() => {
    if (!isAuthenticated || !user || !slug) return;
    let cancelled = false;
    setWorldStatus("loading");
    (async () => {
      try {
        const wr = await apiFetch(
          API.ENGAGEMENT,
          `/api/engagement/quests/worlds/${encodeURIComponent(slug)}`,
        );
        if (cancelled) return;
        if (wr.status === 404) {
          setWorldStatus("not_found");
          return;
        }
        if (!wr.ok) {
          setWorldStatus("error");
          return;
        }
        const resolved: QuestWorld = await wr.json();
        setWorld(resolved);
        setWorldStatus("found");
        const [qr, pr] = await Promise.all([
          apiFetch(API.ENGAGEMENT, `/api/engagement/quests/${resolved.key}`),
          apiFetch(API.ENGAGEMENT, `/api/engagement/quests/progress/${user.id}`),
        ]);
        if (cancelled) return;
        if (qr.ok) {
          const body = await qr.json();
          setChapters(body.quests ?? []);
        }
        if (pr.ok) setProgress(await pr.json());
      } catch {
        if (!cancelled) setWorldStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user, slug]);

  const startQuest = useCallback(
    async (questId: string) => {
      if (!user || !world) return;
      setStarting(questId);
      try {
        const res = await apiFetch(API.ENGAGEMENT, "/api/engagement/quests/start", {
          method: "POST",
          body: JSON.stringify({ learnerId: user.id, questId }),
        });
        if (res.ok) {
          router.push(`/(learner)/quests/${world.key}/play/${questId}` as any);
        }
      } finally {
        setStarting(null);
      }
    },
    [user, world],
  );

  if (worldStatus === "loading") {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      </View>
    );
  }

  if (worldStatus === "not_found" || !world) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backRow}>
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={styles.backText}>{t("common.back")}</Text>
        </Pressable>
        <Text style={styles.notFoundTitle}>Quest world not found</Text>
        <Text style={styles.notFoundSlug}>{slug}</Text>
      </View>
    );
  }

  const progressMap = new Map<string, QuestProgress>(progress.map((p) => [p.questId, p]));
  const sortedChapters = [...chapters].sort((a, b) => a.chapterNumber - b.chapterNumber);
  const decorated = sortedChapters.reduce<(QuestRow & { uiStatus: UiStatus })[]>((acc, q) => {
    const prev = acc[acc.length - 1];
    const prevCompleted = prev ? prev.uiStatus === "completed" : true;
    acc.push({ ...q, uiStatus: deriveStatus(q, progressMap, prevCompleted) });
    return acc;
  }, []);
  const completedCount = decorated.filter((d) => d.uiStatus === "completed").length;
  const totalXp = decorated.reduce(
    (sum, d) => sum + (d.uiStatus === "completed" ? (d.xpReward ?? 0) : 0),
    0,
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32 }}
    >
      <Pressable accessibilityRole="button" onPress={() => router.push("/(learner)/quests" as any)} style={styles.backRow}>
        <Ionicons name="arrow-back" size={20} color={colors.primary} />
        <Text style={styles.backText}>{t("common.back")}</Text>
      </Pressable>
      <Text style={styles.title}>{world.name}</Text>
      <Text style={styles.subtitle}>{world.description}</Text>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {completedCount}/{world.chapters}
          </Text>
          <Text style={styles.statLabel}>chapters</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{totalXp}</Text>
          <Text style={styles.statLabel}>XP</Text>
        </View>
      </View>

      {decorated.map((q) => {
        const locked = q.uiStatus === "locked";
        return (
          <Card key={q.id} style={[styles.chapterCard, locked ? { opacity: 0.55 } : null]}>
            <View style={styles.chapterHeader}>
              <Text style={styles.chapterTitle}>{q.title}</Text>
              <Text style={styles.xpBadge}>+{q.xpReward ?? 0} XP</Text>
            </View>
            {q.description ? <Text style={styles.chapterDesc}>{q.description}</Text> : null}
            <View style={styles.chapterActions}>
              {q.uiStatus === "completed" && (
                <View style={[styles.statusPill, { backgroundColor: colors.success }]}>
                  <Ionicons name="checkmark" size={14} color={colors.white} />
                  <Text style={styles.statusPillText}>Completed</Text>
                </View>
              )}
              {q.uiStatus === "available" && (
                <Pressable accessibilityRole="button"
                  onPress={() => startQuest(q.id)}
                  disabled={starting === q.id}
                  style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.85 }]}
                >
                  <Text style={styles.primaryButtonText}>
                    {starting === q.id ? "Starting…" : "Start quest"}
                  </Text>
                </Pressable>
              )}
              {q.uiStatus === "in_progress" && (
                <Pressable accessibilityRole="button"
                  onPress={() => router.push(`/(learner)/quests/${world.key}/play/${q.id}` as any)}
                  style={styles.primaryButton}
                >
                  <Text style={styles.primaryButtonText}>Continue</Text>
                </Pressable>
              )}
              {q.uiStatus === "locked" && (
                <View style={styles.lockedRow}>
                  <Ionicons name="lock-closed" size={14} color={colors.textSecondary} />
                  <Text style={styles.lockedText}>Finish the previous chapter to unlock</Text>
                </View>
              )}
            </View>
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  backRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md },
  backText: { fontSize: 16, fontFamily: fontFamilies.bodySemiBold, color: colors.primary },
  title: { fontSize: 24, fontFamily: fontFamilies.bodyExtraBold, color: colors.text },
  subtitle: {
    fontSize: 14,
    fontFamily: fontFamilies.bodyRegular,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  statsRow: { flexDirection: "row", gap: spacing.lg, marginBottom: spacing.lg },
  stat: { gap: 2 },
  statValue: { fontSize: 22, fontFamily: fontFamilies.bodyExtraBold, color: colors.text },
  statLabel: {
    fontSize: 11,
    fontFamily: fontFamilies.bodySemiBold,
    color: colors.textSecondary,
    textTransform: "uppercase",
  },
  chapterCard: { marginBottom: spacing.sm },
  chapterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  chapterTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: fontFamilies.bodyBold,
    color: colors.text,
    marginRight: spacing.sm,
  },
  xpBadge: { fontSize: 13, fontFamily: fontFamilies.bodyBold, color: colors.warning },
  chapterDesc: {
    fontSize: 13,
    fontFamily: fontFamilies.bodyRegular,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  chapterActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  primaryButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    minHeight: 44,
    justifyContent: "center",
  },
  primaryButtonText: { color: colors.white, fontFamily: fontFamilies.bodyBold, fontSize: 14 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.lg,
  },
  statusPillText: { color: colors.white, fontFamily: fontFamilies.bodyBold, fontSize: 12 },
  lockedRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  lockedText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: fontFamilies.bodySemiBold,
  },
  notFoundTitle: {
    fontSize: 20,
    fontFamily: fontFamilies.bodyExtraBold,
    color: colors.text,
    marginTop: spacing.xl,
  },
  notFoundSlug: {
    fontSize: 13,
    fontFamily: fontFamilies.bodyRegular,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
