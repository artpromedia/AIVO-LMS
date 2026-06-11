import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TextInput,
  Alert,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useLearners } from "@/hooks/useLearners";
import {
  useBrainRecommendations,
  useRecommendationAction,
  RecommendationAmendedPayload,
} from "@/hooks/useBrain";
import { AivoCard, AivoButton, EmptyState, LoadingState } from "@aivo/mobile-ui";
import { colors, spacing, radius } from "@/constants/colors";
import { useWindowSizeClass } from "@/src/design/useWindowSizeClass";
import { CONTENT_MAX_WIDTH, pickBySizeClass } from "@/src/design/responsive";
import { SplitPane } from "@/src/components/layout/SplitPane";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";

const AMEND_FIELD: Record<string, keyof RecommendationAmendedPayload | null> = {
  accommodation_add: "accommodation",
  accommodation_remove: "accommodation",
  tutor_suggestion: "tutor",
  functioning_level_change: "level",
  curriculum_shift: "curriculumId",
  path_adjustment: "proposedValue",
  regression_alert: "proposedValue",
  goal_suggestion: "proposedValue",
  iep_goal_met: "proposedValue",
  iep_refresh: "proposedValue",
  rebaseline: null,
  brain_profile_review: null,
  brain_upgrade: null,
};

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export default function RecommendationsScreen() {
  const insets = useSafeAreaInsets();
  const { data: learners } = useLearners();
  const firstLearnerId = learners?.[0]?.id || "";
  const { data: recommendations, isLoading, refetch } = useBrainRecommendations(firstLearnerId);
  const action = useRecommendationAction();
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [amendValues, setAmendValues] = useState<Record<string, string>>({});
  const [selectedRecId, setSelectedRecId] = useState<string | null>(null);
  const { sizeClass, isTablet, width: winWidth } = useWindowSizeClass();
  const hPad = pickBySizeClass(sizeClass, {
    compact: spacing.md,
    medium: spacing.lg,
    expanded: spacing.xl,
  });
  const contentWidth = Math.min(
    winWidth - hPad * 2,
    isTablet ? CONTENT_MAX_WIDTH.dashboard : winWidth,
  );

  const pending = recommendations?.filter((r) => r.status === "PENDING") ?? [];

  const respond = async (
    rec: (typeof pending)[number],
    actionType: "approve" | "decline" | "adjust",
  ) => {
    try {
      const payload = rec.payload as Record<string, unknown> | null;
      let amendedPayload: RecommendationAmendedPayload | undefined;
      if (actionType === "adjust") {
        const field = AMEND_FIELD[rec.type];
        const value = amendValues[rec.id] ?? "";
        if (!value.trim()) {
          Alert.alert(t("common.error"), t("parentRecommendations.amendValueRequired"));
          return;
        }
        amendedPayload = field ? { [field]: value } : { proposedValue: value };
      }
      await action.mutateAsync({
        learnerId: firstLearnerId,
        recommendationId: rec.id,
        action: actionType,
        amendedPayload,
      });
      setExpandedId(null);
      void payload;
    } catch (err) {
      Alert.alert(t("common.error"), err instanceof Error ? err.message : "Failed");
    }
  };

  if (isLoading) return <LoadingState />;

  const activeRec = pending.find((r) => r.id === selectedRecId) ?? pending[0] ?? null;

  const renderRec = (rec: (typeof pending)[number], compact: boolean) => {
    const payload = (rec.payload as Record<string, unknown> | null) || null;
    const canAmend = AMEND_FIELD[rec.type] !== null && AMEND_FIELD[rec.type] !== undefined;
    const isExpanded = expandedId === rec.id;
    const amendInitial = canAmend
      ? formatValue(payload?.[AMEND_FIELD[rec.type] as string] ?? payload?.proposedValue)
      : "";
    const isActive = activeRec?.id === rec.id;
    if (compact) {
      return (
        <Pressable
          key={rec.id}
          onPress={() => setSelectedRecId(rec.id)}
          accessibilityRole="button"
          accessibilityState={{ selected: isActive }}
        >
          <AivoCard style={[styles.recCardCompact, isActive && styles.recCardActive]}>
            <View style={styles.recHeader}>
              <View style={[styles.typeBadge, { backgroundColor: colors.info + "20" }]}>
                <Text style={[styles.typeText, { color: colors.info }]} numberOfLines={1}>
                  {rec.type}
                </Text>
              </View>
              <Text style={styles.recDate}>{new Date(rec.createdAt).toLocaleDateString()}</Text>
            </View>
            <Text style={styles.recTitle} numberOfLines={2}>
              {rec.title}
            </Text>
            {rec.confidence != null ? (
              <Text style={styles.recConfidence}>
                {(rec.confidence * 100).toFixed(0)}% confident
              </Text>
            ) : null}
          </AivoCard>
        </Pressable>
      );
    }
    return (
      <AivoCard key={rec.id} style={styles.recCard}>
        <View style={styles.recHeader}>
          <View style={[styles.typeBadge, { backgroundColor: colors.info + "20" }]}>
            <Text style={[styles.typeText, { color: colors.info }]}>{rec.type}</Text>
          </View>
          <Text style={styles.recDate}>{new Date(rec.createdAt).toLocaleDateString()}</Text>
        </View>
        <Text style={styles.recTitle}>{rec.title}</Text>
        {rec.description && <Text style={styles.recDesc}>{rec.description}</Text>}

        {payload && (
          <View style={styles.payload}>
            {payload.currentValue != null && (
              <Text style={styles.payloadLine}>
                <Text style={styles.payloadLabel}>Current: </Text>
                {formatValue(payload.currentValue)}
              </Text>
            )}
            {payload.proposedValue != null && (
              <Text style={styles.payloadLine}>
                <Text style={styles.payloadLabel}>Proposed: </Text>
                {formatValue(payload.proposedValue)}
              </Text>
            )}
            {typeof payload.reason === "string" && (
              <Text style={styles.payloadLine}>
                <Text style={styles.payloadLabel}>Why: </Text>
                {payload.reason}
              </Text>
            )}
            {rec.confidence != null && (
              <Text style={styles.payloadLine}>
                <Text style={styles.payloadLabel}>Confidence: </Text>
                {(rec.confidence * 100).toFixed(0)}%
              </Text>
            )}
          </View>
        )}

        {rec.applyError && (
          <Text style={styles.applyError}>Last attempt failed: {rec.applyError}</Text>
        )}

        {isExpanded && canAmend && (
          <View style={styles.amendBox}>
            <Text style={styles.amendLabel}>{t("parentRecommendations.adjustValueLabel")}</Text>
            <TextInput accessibilityLabel="Text input field"
              style={styles.amendInput}
              value={amendValues[rec.id] ?? amendInitial}
              onChangeText={(v) => setAmendValues((prev) => ({ ...prev, [rec.id]: v }))}
              placeholder={amendInitial}
            />
          </View>
        )}

        <View style={styles.recActions}>
          <AivoButton
            title={t("common.approve")}
            onPress={() => respond(rec, "approve")}
            size="sm"
            style={{ flex: 1, marginRight: 6 }}
          />
          {canAmend && (
            <AivoButton
              title={isExpanded ? t("common.adjust") : t("parentRecommendations.adjust")}
              onPress={() => (isExpanded ? respond(rec, "adjust") : setExpandedId(rec.id))}
              variant="outline"
              size="sm"
              style={{ flex: 1, marginRight: 6 }}
            />
          )}
          <AivoButton
            title={t("common.decline")}
            onPress={() => respond(rec, "decline")}
            variant="outline"
            size="sm"
            style={{ flex: 1 }}
          />
        </View>
      </AivoCard>
    );
  };

  const emptyState = (
    <EmptyState
      icon={<Ionicons name="checkmark-circle-outline" size={48} color={colors.success} />}
      title={t("parentRecommendations.allCaughtUp")}
      message={t("parentRecommendations.noPending")}
    />
  );

  // Tablet console: queue on the left, detail panel on the right.
  if (isTablet && pending.length > 0) {
    return (
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + 16, paddingHorizontal: hPad, alignItems: "center" },
        ]}
      >
        <View style={{ width: contentWidth, flex: 1 }}>
          <Text style={styles.title}>{t("parentRecommendations.title")}</Text>
          <Text style={styles.subtitle}>{t("parentRecommendations.subtitle")}</Text>
          <SplitPane
            leftWidth={320}
            left={
              <ScrollView
                refreshControl={
                  <RefreshControl
                    refreshing={false}
                    onRefresh={refetch}
                    colors={[colors.primary]}
                  />
                }
              >
                {pending.map((rec) => renderRec(rec, true))}
              </ScrollView>
            }
            right={
              <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
                {activeRec ? renderRec(activeRec, false) : emptyState}
              </ScrollView>
            }
          />
        </View>
      </View>
    );
  }

  // Phone (and compact-width multitasking) path: single column routed
  // through the shared scaffold. `maxWidth="dashboard"` mirrors the cap
  // the tablet console uses; on compact widths it never binds, so the
  // column is full width minus the size-class padding — no hand-rolled
  // inset/width math.
  return (
    <ResponsiveScreen
      maxWidth="dashboard"
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={refetch} colors={[colors.primary]} />
      }
    >
      <Text style={styles.title}>{t("parentRecommendations.title")}</Text>
      <Text style={styles.subtitle}>{t("parentRecommendations.subtitle")}</Text>
      {pending.length === 0 ? emptyState : pending.map((rec) => renderRec(rec, false))}
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: 24, fontFamily: "Nunito-ExtraBold", color: colors.text },
  subtitle: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  recCard: { marginBottom: spacing.md },
  recCardCompact: { marginBottom: spacing.sm, padding: spacing.sm },
  recCardActive: { borderWidth: 2, borderColor: colors.primary },
  recConfidence: {
    fontSize: 11,
    fontFamily: "Nunito-SemiBold",
    color: colors.textSecondary,
    marginTop: 4,
  },
  recHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full },
  typeText: { fontSize: 12, fontFamily: "Nunito-SemiBold" },
  recDate: { fontSize: 12, fontFamily: "Nunito-Regular", color: colors.textSecondary },
  recTitle: { fontSize: 16, fontFamily: "Nunito-Bold", color: colors.text, marginBottom: 4 },
  recDesc: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  recActions: { flexDirection: "row" },
  payload: {
    backgroundColor: colors.background,
    padding: 10,
    borderRadius: radius.md,
    marginBottom: 10,
  },
  payloadLine: { fontSize: 12, fontFamily: "Nunito-Regular", color: colors.text, marginBottom: 2 },
  payloadLabel: { fontFamily: "Nunito-Bold", color: colors.textSecondary },
  applyError: { fontSize: 12, color: colors.error, marginBottom: 8 },
  amendBox: { marginBottom: 10 },
  amendLabel: {
    fontSize: 12,
    fontFamily: "Nunito-Bold",
    color: colors.textSecondary,
    marginBottom: 4,
  },
  amendInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.text,
  },
});
