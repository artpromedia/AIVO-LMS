import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";
import { AivoCard } from "@aivo/mobile-ui";
import { colors, spacing } from "@/constants/colors";

interface QuestWorld {
  key: string;
  name: string;
  tutorKey: string;
  subject: string;
  description: string;
  chapters: number;
}

interface QuestProgressRow {
  questId: string;
  status: string;
}

interface QuestChapter {
  id: string;
  worldKey: string;
  chapterNumber: number;
}

const WORLD_ICONS: Record<string, string> = {
  nova_number_galaxy: "✨",
  sage_story_kingdom: "📚",
  spark_science_lab: "🔬",
  chrono_time_tower: "🏰",
  pixel_code_forge: "💻",
};

const WORLD_TINTS: Record<string, string> = {
  nova_number_galaxy: "#6366f1",
  sage_story_kingdom: "#059669",
  spark_science_lab: "#f59e0b",
  chrono_time_tower: "#8b5cf6",
  pixel_code_forge: "#3b82f6",
};

export default function QuestsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();

  const [worlds, setWorlds] = useState<QuestWorld[]>([]);
  const [progress, setProgress] = useState<Map<string, QuestProgressRow>>(new Map());
  const [chaptersByWorld, setChaptersByWorld] = useState<Map<string, QuestChapter[]>>(new Map());
  const [loadStatus, setLoadStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    let cancelled = false;
    (async () => {
      try {
        setLoadStatus("loading");
        const wr = await apiFetch(API.ENGAGEMENT, "/api/engagement/quests/worlds");
        if (!wr.ok) throw new Error(`worlds ${wr.status}`);
        const list: QuestWorld[] = await wr.json();
        if (cancelled) return;
        setWorlds(list);

        const [pr, ...chapterRes] = await Promise.all([
          apiFetch(API.ENGAGEMENT, `/api/engagement/quests/progress/${user.id}`),
          ...list.map((w) =>
            apiFetch(API.ENGAGEMENT, `/api/engagement/quests/${w.key}`).then((r) =>
              r.ok ? r.json() : { quests: [] },
            ),
          ),
        ]);
        if (cancelled) return;
        if (pr.ok) {
          const rows = (await pr.json()) as QuestProgressRow[];
          setProgress(new Map(rows.map((r) => [r.questId, r])));
        }
        const chapterMap = new Map<string, QuestChapter[]>();
        list.forEach((w, i) => chapterMap.set(w.key, chapterRes[i]?.quests ?? []));
        setChaptersByWorld(chapterMap);
        setLoadStatus("ok");
      } catch {
        if (!cancelled) setLoadStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32 }}
    >
      <Pressable onPress={() => router.back()} style={styles.backRow}>
        <Ionicons name="arrow-back" size={20} color={colors.primary} />
        <Text style={styles.backText}>{t("common.back")}</Text>
      </Pressable>
      <Text style={styles.title}>{t("learnerQuests.title")}</Text>
      <Text style={styles.subtitle}>{t("learnerQuests.subtitle")}</Text>

      {loadStatus === "loading" && (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      )}

      {loadStatus === "error" && (
        <View style={styles.errorBlock}>
          <Text style={styles.errorText}>
            Couldn&apos;t load Quest Worlds. Pull to refresh later.
          </Text>
        </View>
      )}

      {loadStatus === "ok" &&
        worlds.map((world) => {
          const chapters = chaptersByWorld.get(world.key) ?? [];
          const completedCount = chapters.filter(
            (c) => progress.get(c.id)?.status === "COMPLETED",
          ).length;
          const total = world.chapters || chapters.length || 5;
          const tint = WORLD_TINTS[world.key] || colors.primary;
          return (
            <Pressable
              key={world.key}
              onPress={() => router.push(`/(learner)/quests/${world.key}` as any)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${world.name}`}
            >
              <AivoCard style={[styles.questCard, { borderLeftColor: tint, borderLeftWidth: 4 }]}>
                <View style={styles.questRow}>
                  <View style={[styles.questIcon, { backgroundColor: tint + "20" }]}>
                    <Text style={{ fontSize: 28 }}>{WORLD_ICONS[world.key] ?? "🌟"}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.questName}>{world.name}</Text>
                    <Text style={styles.questDomain}>{world.subject}</Text>
                    <View style={styles.chapterProgress}>
                      <View
                        style={[
                          styles.chapterFill,
                          {
                            width: `${total > 0 ? Math.round((completedCount / total) * 100) : 0}%`,
                            backgroundColor: tint,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.chapterText}>
                      {t("learnerQuests.chapter", { current: completedCount, total })}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </View>
              </AivoCard>
            </Pressable>
          );
        })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  backRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md },
  backText: { fontSize: 16, fontFamily: "Nunito-SemiBold", color: colors.primary },
  title: { fontSize: 24, fontFamily: "Nunito-ExtraBold", color: colors.text },
  subtitle: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  questCard: { marginBottom: spacing.sm },
  questRow: { flexDirection: "row", alignItems: "center" },
  questIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  questName: { fontSize: 16, fontFamily: "Nunito-Bold", color: colors.text },
  questDomain: {
    fontSize: 12,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginTop: 2,
  },
  chapterProgress: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    marginTop: 6,
    overflow: "hidden",
  },
  chapterFill: { height: 6, borderRadius: 3 },
  chapterText: {
    fontSize: 11,
    fontFamily: "Nunito-SemiBold",
    color: colors.textSecondary,
    marginTop: 2,
  },
  errorBlock: {
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: "#fee2e2",
    borderRadius: 12,
  },
  errorText: {
    color: "#991b1b",
    fontFamily: "Nunito-SemiBold",
    fontSize: 14,
  },
});
