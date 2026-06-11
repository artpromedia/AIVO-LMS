import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { Card } from "@/components/ui";
import { colors, spacing, radius } from "@/constants/colors";
import {
  useRecommendations,
  useRespondToRecommendation,
  type ProfileRecommendation,
} from "@/src/api/recommendationsClient";

/**
 * Parent recommendation approval screen (adaptive-learning E2E Sprint 5) —
 * mirror of web's PendingRecommendationsPanel. Lists PENDING profile
 * recommendations for one learner with Approve / Adjust / Decline; the
 * server applies the effect durably on approval (Sprint 4) and the list
 * refreshes via query invalidation.
 */
export default function RecommendationsScreen() {
  const { t } = useTranslation();
  const { learnerId } = useLocalSearchParams<{ learnerId: string }>();
  const id = learnerId ?? "";
  const { data, isLoading, isError, refetch, isRefetching } = useRecommendations(id);
  const respond = useRespondToRecommendation(id);

  const pending = (data ?? []).filter((r) => r.status === "PENDING");
  const decided = (data ?? []).filter((r) => r.status !== "PENDING").slice(0, 10);

  return (
    <ResponsiveScreen
      scroll={false}
      accessibilityLabel={t("recommendations.title", "Recommendations")}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
      >
        {isLoading ? (
          <ActivityIndicator accessibilityLabel={t("common.loading", "Loading")} />
        ) : isError ? (
          <Card style={styles.card}>
            <Text style={styles.error}>
              {t("recommendations.loadError", "Couldn't load recommendations — pull to retry.")}
            </Text>
          </Card>
        ) : pending.length === 0 ? (
          <Card style={styles.card}>
            <Text style={styles.muted}>
              {t("recommendations.empty", "No recommendations waiting for your approval.")}
            </Text>
          </Card>
        ) : (
          pending.map((rec) => (
            <RecommendationCard
              key={rec.id}
              rec={rec}
              busy={respond.isPending}
              onRespond={(action, extra) =>
                respond.mutate({ recId: rec.id, action, ...extra })
              }
            />
          ))
        )}

        {decided.length > 0 ? (
          <Card style={styles.card}>
            <Text style={styles.historyTitle}>
              {t("recommendations.history", "Recent decisions")}
            </Text>
            {decided.map((d) => (
              <View key={d.id} style={styles.historyRow}>
                <Text style={styles.historyText} numberOfLines={1}>
                  {d.title}
                </Text>
                <Text style={styles.historyStatus}>{d.status}</Text>
              </View>
            ))}
          </Card>
        ) : null}
      </ScrollView>
    </ResponsiveScreen>
  );
}

function valueLabel(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if ("from" in v && "to" in v) {
      const range = `${String(v.from)} → ${String(v.to)}`;
      // Wave C (G1): subject-scoped proposals name the subject that moves.
      return typeof v.subjectKey === "string" && v.subjectKey.length > 0
        ? `${v.subjectKey}: ${range}`
        : range;
    }
    if ("reason" in v) return String(v.reason);
    return JSON.stringify(v);
  }
  return String(value);
}

function RecommendationCard({
  rec,
  busy,
  onRespond,
}: {
  rec: ProfileRecommendation;
  busy: boolean;
  onRespond: (
    action: "accept" | "amend" | "decline",
    extra: { amendedValue?: unknown; reason?: string },
  ) => void;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"none" | "amend" | "decline">("none");
  const [amendValue, setAmendValue] = useState("");
  const [reason, setReason] = useState("");

  return (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name="sparkles" size={18} color={colors.primary} />
        <Text style={styles.title}>{rec.title}</Text>
      </View>
      <Text style={styles.muted}>{rec.parentSummary}</Text>
      <Text style={styles.proposed}>
        {t("recommendations.proposed", "Proposed change")}: {valueLabel(rec.proposedValue)}
      </Text>

      {mode === "amend" ? (
        <View style={styles.inlineRow}>
          <TextInput
            style={styles.input}
            value={amendValue}
            onChangeText={setAmendValue}
            placeholder={t("recommendations.amendPlaceholder", "New value")}
            accessibilityLabel={t("recommendations.amendPlaceholder", "New value")}
          />
          <ActionButton
            label={t("recommendations.confirmAdjust", "Apply")}
            disabled={busy || amendValue.trim() === ""}
            onPress={() => onRespond("amend", { amendedValue: amendValue })}
          />
          <ActionButton
            label={t("common.cancel", "Cancel")}
            variant="ghost"
            disabled={busy}
            onPress={() => setMode("none")}
          />
        </View>
      ) : mode === "decline" ? (
        <View style={styles.inlineRow}>
          <TextInput
            style={styles.input}
            value={reason}
            onChangeText={setReason}
            placeholder={t("recommendations.declineReason", "Why decline?")}
            accessibilityLabel={t("recommendations.declineReason", "Why decline?")}
          />
          <ActionButton
            label={t("recommendations.confirmDecline", "Decline")}
            variant="outline"
            disabled={busy || reason.trim() === ""}
            onPress={() => onRespond("decline", { reason })}
          />
          <ActionButton
            label={t("common.cancel", "Cancel")}
            variant="ghost"
            disabled={busy}
            onPress={() => setMode("none")}
          />
        </View>
      ) : (
        <View style={styles.inlineRow}>
          <ActionButton
            label={t("recommendations.approve", "Approve")}
            disabled={busy}
            onPress={() => onRespond("accept", {})}
          />
          <ActionButton
            label={t("recommendations.adjust", "Adjust")}
            variant="outline"
            disabled={busy}
            onPress={() => setMode("amend")}
          />
          <ActionButton
            label={t("recommendations.decline", "Decline")}
            variant="ghost"
            disabled={busy}
            onPress={() => setMode("decline")}
          />
        </View>
      )}
    </Card>
  );
}

function ActionButton({
  label,
  onPress,
  disabled,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "outline" | "ghost";
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        variant === "outline" && styles.buttonOutline,
        variant === "ghost" && styles.buttonGhost,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text
        style={[styles.buttonLabel, variant !== "primary" && styles.buttonLabelAlt]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.md, gap: spacing.md },
  card: { padding: spacing.md, gap: spacing.xs },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  title: { fontSize: 16, fontWeight: "700", flexShrink: 1 },
  muted: { color: colors.textSecondary, fontSize: 14 },
  proposed: { fontSize: 14, fontWeight: "600", marginTop: spacing.xs },
  error: { color: "#b91c1c", fontSize: 14 },
  inlineRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: radius.sm ?? 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    minWidth: 120,
    flexGrow: 1,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md ?? 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  buttonOutline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.primary,
  },
  buttonGhost: { backgroundColor: "transparent" },
  buttonDisabled: { opacity: 0.5 },
  buttonLabel: { color: "#fff", fontWeight: "700" },
  buttonLabelAlt: { color: colors.primary },
  historyTitle: { fontWeight: "700", marginBottom: spacing.xs },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingVertical: 2,
  },
  historyText: { flexShrink: 1, fontSize: 13 },
  historyStatus: { fontSize: 13, color: colors.textSecondary },
});
