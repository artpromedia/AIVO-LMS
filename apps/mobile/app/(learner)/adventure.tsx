import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";
import { colors, spacing } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";
import { useResponsiveType } from "@/src/design/useResponsiveType";

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

// Presentational only — keyed by the server's world keys.
const WORLD_ICONS: Record<string, string> = {
  nova_number_galaxy: "🌌",
  sage_story_kingdom: "🌿",
  spark_science_lab: "🔬",
  chrono_time_tower: "🏰",
  pixel_code_forge: "💻",
};

interface WorldNode extends QuestWorld {
  completed: number;
  total: number;
  isComplete: boolean;
  unlocked: boolean;
}

export default function AdventureScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const type = useResponsiveType();
  const { user, isAuthenticated } = useAuth();

  const [nodes, setNodes] = useState<WorldNode[]>([]);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    let cancelled = false;
    (async () => {
      try {
        setLoadStatus("loading");
        const wr = await apiFetch(API.ENGAGEMENT, "/api/engagement/quests/worlds");
        if (!wr.ok) throw new Error(`worlds ${wr.status}`);
        const worlds: QuestWorld[] = await wr.json();
        if (cancelled) return;

        const [pr, ...chapterRes] = await Promise.all([
          apiFetch(API.ENGAGEMENT, `/api/engagement/quests/progress/${user.id}`),
          ...worlds.map((w) =>
            apiFetch(API.ENGAGEMENT, `/api/engagement/quests/${w.key}`).then((r) =>
              r.ok ? r.json() : { quests: [] },
            ),
          ),
        ]);
        if (cancelled) return;

        const progress = new Map<string, QuestProgressRow>();
        if (pr.ok) {
          const rows = (await pr.json()) as QuestProgressRow[];
          rows.forEach((r) => progress.set(r.questId, r));
        }

        // Build each world's completion, then unlock sequentially: the
        // first world is always open, and each subsequent world unlocks
        // once the previous one is fully completed.
        let prevComplete = true;
        const built: WorldNode[] = worlds.map((w, i) => {
          const chapters: QuestChapter[] = chapterRes[i]?.quests ?? [];
          const completed = chapters.filter(
            (c) => progress.get(c.id)?.status === "COMPLETED",
          ).length;
          const total = w.chapters || chapters.length || 0;
          const isComplete = total > 0 && completed >= total;
          const unlocked = prevComplete;
          prevComplete = isComplete;
          return { ...w, completed, total, isComplete, unlocked };
        });

        setNodes(built);
        setLoadStatus("ok");
      } catch {
        if (!cancelled) setLoadStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user]);

  const current = nodes.find((n) => n.unlocked && !n.isComplete) ?? nodes[0];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32 }}
    >
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backRow}>
        <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.7)" />
        <Text style={styles.backText}>{t("common.back")}</Text>
      </Pressable>

      <View style={styles.content}>
        <Text
          style={[
            styles.title,
            {
              fontSize: Math.max(styles.title.fontSize, type.h1.fontSize),
              lineHeight: Math.max(styles.title.fontSize + 4, type.h1.lineHeight),
            },
          ]}
        >
          {t("learnerAdventure.title")}
        </Text>
        <Text style={styles.subtitle}>{t("learnerAdventure.subtitle")}</Text>

        {loadStatus === "loading" && (
          <ActivityIndicator color={colors.white} style={{ marginTop: spacing.xl }} />
        )}

        {loadStatus === "error" && (
          <View style={styles.errorBlock}>
            <Text style={styles.errorText}>
              {t("learnerAdventure.loadError", "Couldn't load your adventure. Try again later.")}
            </Text>
          </View>
        )}

        {loadStatus === "ok" && (
          <>
            <View style={styles.chapters}>
              {nodes.map((node) => {
                const isCurrent = current?.key === node.key && !node.isComplete;
                return (
                  <Pressable
                    key={node.key}
                    accessibilityRole="button"
                    accessibilityLabel={`${node.name}, ${node.completed}/${node.total}`}
                    disabled={!node.unlocked}
                    onPress={() => router.push(`/(learner)/quests/${node.key}` as any)}
                    style={[
                      styles.chapterCard,
                      isCurrent && styles.chapterActive,
                      !node.unlocked && styles.chapterLocked,
                    ]}
                  >
                    <Text style={styles.chapterIcon}>{WORLD_ICONS[node.key] ?? "🌟"}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.chapterName}>{node.name}</Text>
                      <Text style={styles.chapterDomain}>
                        {node.subject} · {node.completed}/{node.total}
                      </Text>
                    </View>
                    {node.isComplete ? (
                      <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                    ) : !node.unlocked ? (
                      <Ionicons name="lock-closed" size={18} color="rgba(255,255,255,0.3)" />
                    ) : isCurrent ? (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentText}>{t("learnerAdventure.start")}</Text>
                      </View>
                    ) : (
                      <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
                    )}
                  </Pressable>
                );
              })}
            </View>

            {current && (
              <Button
                title={t("learnerAdventure.beginAdventure")}
                onPress={() => router.push(`/(learner)/quests/${current.key}` as any)}
                size="lg"
                style={{ marginTop: spacing.lg }}
              />
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1A1A2E", paddingHorizontal: spacing.md },
  backRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.lg },
  backText: { fontSize: 16, fontFamily: fontFamilies.bodySemiBold, color: "rgba(255,255,255,0.7)" },
  content: { flex: 1 },
  title: { fontSize: 28, fontFamily: fontFamilies.bodyExtraBold, color: colors.white, textAlign: "center" },
  subtitle: {
    fontSize: 16,
    fontFamily: fontFamilies.bodyRegular,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    marginTop: 4,
    marginBottom: spacing.xl,
  },
  chapters: { gap: 10 },
  chapterCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: spacing.md,
    gap: 12,
  },
  chapterActive: {
    backgroundColor: colors.primary + "30",
    borderWidth: 1,
    borderColor: colors.primary,
  },
  chapterLocked: { opacity: 0.55 },
  chapterIcon: { fontSize: 28 },
  chapterName: { fontSize: 15, fontFamily: fontFamilies.bodyBold, color: colors.white },
  chapterDomain: { fontSize: 12, fontFamily: fontFamilies.bodyRegular, color: "rgba(255,255,255,0.6)" },
  currentBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  currentText: { fontSize: 12, fontFamily: fontFamilies.bodyBold, color: colors.white },
  errorBlock: {
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
  },
  errorText: {
    color: "rgba(255,255,255,0.85)",
    fontFamily: fontFamilies.bodySemiBold,
    fontSize: 14,
    textAlign: "center",
  },
});
