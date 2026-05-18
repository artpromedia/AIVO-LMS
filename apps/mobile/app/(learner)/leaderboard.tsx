import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { useLeaderboard } from "@/hooks/useEngagement";
import { AivoCard } from "@aivo/mobile-ui";
import { colors, spacing, radius } from "@/constants/colors";

type Scope = "global" | "class" | "school";

interface LeaderboardEntry {
  id: string;
  learnerId: string;
  totalXp: number;
  level: number;
  weeklyXp: number;
  rank: number | null;
}

const MEDAL_ICONS: (keyof typeof Ionicons.glyphMap)[] = ["trophy", "medal", "ribbon"];
const MEDAL_TINTS = ["#F59E0B", "#94A3B8", "#EA580C"];

export default function LearnerLeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [scope, setScope] = useState<Scope>("global");
  const { data, isLoading } = useLeaderboard(scope);
  const entries = (data ?? []) as LeaderboardEntry[];

  const scopes: { key: Scope; label: string }[] = [
    { key: "global", label: t("learnerLeaderboard.scopeGlobal") },
    { key: "class", label: t("learnerLeaderboard.scopeClass") },
    { key: "school", label: t("learnerLeaderboard.scopeSchool") },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32 }}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>{t("learnerLeaderboard.title")}</Text>
        <View style={{ width: 24 }} />
      </View>

      <Text style={styles.subtitle}>{t("learnerLeaderboard.subtitle")}</Text>

      <View style={styles.scopeRow}>
        {scopes.map(({ key, label }) => {
          const active = scope === key;
          return (
            <Pressable
              key={key}
              onPress={() => setScope(key)}
              style={[styles.scopePill, active && styles.scopePillActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.scopeLabel, active && styles.scopeLabelActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <AivoCard>
          <Text style={styles.empty}>{t("common.loading")}</Text>
        </AivoCard>
      ) : entries.length === 0 ? (
        <AivoCard style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons name="trophy" size={28} color="#F59E0B" />
          </View>
          <Text style={styles.empty}>{t("learnerLeaderboard.empty")}</Text>
        </AivoCard>
      ) : (
        <AivoCard style={{ padding: 0 }}>
          {entries.map((entry, idx) => {
            const isMe = entry.learnerId === user?.id;
            const medalIcon = idx < 3 ? MEDAL_ICONS[idx] : null;
            const medalTint = idx < 3 ? MEDAL_TINTS[idx] : undefined;
            return (
              <View
                key={entry.id}
                style={[
                  styles.row,
                  isMe && styles.rowMe,
                  idx === entries.length - 1 && styles.rowLast,
                ]}
              >
                <View style={styles.rankCell}>
                  {medalIcon ? (
                    <Ionicons name={medalIcon} size={22} color={medalTint} />
                  ) : (
                    <Text style={styles.rankText}>{idx + 1}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    {isMe
                      ? t("learnerLeaderboard.youSuffix", { name: user?.name ?? "" })
                      : t("learnerLeaderboard.learnerName", { id: entry.learnerId.slice(0, 6) })}
                  </Text>
                  <Text style={styles.level}>{t("learner.level", { level: entry.level })}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.xp}>{entry.totalXp} XP</Text>
                  <Text style={styles.weekly}>
                    {t("learnerLeaderboard.weeklyXp", { xp: entry.weeklyXp || 0 })}
                  </Text>
                </View>
              </View>
            );
          })}
        </AivoCard>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  title: { fontSize: 22, fontFamily: "Nunito-ExtraBold", color: colors.text },
  subtitle: {
    fontSize: 13,
    fontFamily: "Nunito-SemiBold",
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  scopeRow: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: spacing.md },
  scopePill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  scopePillActive: { backgroundColor: "#F59E0B", borderColor: "#F59E0B" },
  scopeLabel: { fontSize: 13, fontFamily: "Nunito-Bold", color: colors.textSecondary },
  scopeLabelActive: { color: "#FFFFFF" },
  emptyCard: { alignItems: "center", paddingVertical: spacing.lg },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  empty: {
    fontSize: 14,
    fontFamily: "Nunito-SemiBold",
    color: colors.textSecondary,
    textAlign: "center",
    padding: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  rowLast: { borderBottomWidth: 0 },
  rowMe: { backgroundColor: colors.primary + "14" },
  rankCell: { width: 32, alignItems: "center", justifyContent: "center" },
  rankText: { fontSize: 16, fontFamily: "Nunito-Bold", color: colors.textSecondary },
  name: { fontSize: 14, fontFamily: "Nunito-Bold", color: colors.text },
  level: { fontSize: 11, fontFamily: "Nunito-SemiBold", color: colors.textSecondary, marginTop: 2 },
  xp: { fontSize: 14, fontFamily: "Nunito-ExtraBold", color: colors.primary },
  weekly: { fontSize: 11, fontFamily: "Nunito-Regular", color: colors.textSecondary, marginTop: 2 },
});
