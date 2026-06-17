import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useConnectedLearners } from "@/hooks/useFamily";
import { useObservations, type CaregiverObservation } from "@/src/api/observations";
import { AivoCard, AivoButton, EmptyState, LoadingState } from "@aivo/mobile-ui";
import { colors, spacing, radius } from "@/constants/colors";

interface ConnectedLearner {
  id: string;
  name: string;
  functioningLevel: string | null;
  gradeLevel: string | null;
}

/**
 * Caregiver observations feed — mobile parity for web's
 * `caregiver/observations`. Lists the ABC-style notes a caregiver has
 * filed for each assigned child (newest first) and links out to the
 * existing per-child "Submit observation" composer. Reads real
 * family-svc data via `useObservations`; renders genuine
 * loading / empty / error states.
 */
export default function CaregiverObservationsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: learnersRaw, isLoading: learnersLoading } = useConnectedLearners();
  const learners: ConnectedLearner[] = useMemo(
    () => (Array.isArray(learnersRaw) ? learnersRaw : []),
    [learnersRaw],
  );

  const [selectedId, setSelectedId] = useState<string>("");
  useEffect(() => {
    if (!selectedId && learners.length > 0) setSelectedId(learners[0].id);
  }, [learners, selectedId]);

  const {
    data: observations,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useObservations(selectedId);

  const selectedName = learners.find((l) => l.id === selectedId)?.name ?? "";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32 }}
    >
      <Text style={styles.title}>{t("caregiverObservations.title", "Observations")}</Text>
      <Text style={styles.subtitle}>
        {t("caregiverObservations.subtitle", "Notes you've shared, newest first")}
      </Text>

      {/* Child selector */}
      {learners.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: spacing.md }}
        >
          {learners.map((l) => {
            const active = l.id === selectedId;
            return (
              <Pressable
                key={l.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setSelectedId(l.id)}
                accessibilityRole="button"
                accessibilityLabel={t("caregiverObservations.selectChild", {
                  name: l.name,
                  defaultValue: `Show observations for ${l.name}`,
                })}
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{l.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {selectedId !== "" && (
        <AivoButton
          title={t("caregiverObservations.add", "Add observation")}
          icon={<Ionicons name="add" size={18} color={colors.white} />}
          onPress={() =>
            router.push(`/(caregiver)/child/${selectedId}/observation` as Href)
          }
          style={{ marginBottom: spacing.md }}
        />
      )}

      {learnersLoading ? (
        <LoadingState message={t("common.loading", "Loading...")} />
      ) : learners.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="people-outline" size={48} color={colors.textSecondary} />}
          title={t("caregiverObservations.noChildrenTitle", "No children assigned")}
          message={t(
            "caregiverObservations.noChildrenMessage",
            "A parent needs to invite you as a caregiver before you can log observations.",
          )}
        />
      ) : isLoading ? (
        <LoadingState message={t("common.loading", "Loading...")} />
      ) : isError ? (
        <AivoCard style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={28} color={colors.error} />
          <Text style={styles.errorTitle}>
            {t("caregiverObservations.errorTitle", "Couldn't load observations")}
          </Text>
          <Text style={styles.errorBody}>
            {error instanceof Error
              ? error.message
              : t("caregiverObservations.errorBody", "Please check your connection and try again.")}
          </Text>
          <AivoButton
            title={t("common.retry", "Retry")}
            variant="outline"
            size="sm"
            loading={isRefetching}
            onPress={() => refetch()}
            style={{ marginTop: spacing.sm }}
          />
        </AivoCard>
      ) : !observations || observations.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="eye-outline" size={48} color={colors.textSecondary} />}
          title={t("caregiverObservations.emptyTitle", "No observations yet")}
          message={t("caregiverObservations.emptyMessage", {
            name: selectedName,
            defaultValue: `Share what you notice and it will show up here for ${selectedName || "this child"}.`,
          })}
          actionLabel={t("caregiverObservations.add", "Add observation")}
          onAction={() => router.push(`/(caregiver)/child/${selectedId}/observation` as Href)}
        />
      ) : (
        observations.map((obs) => <ObservationRow key={obs.id} obs={obs} />)
      )}
    </ScrollView>
  );
}

function ObservationRow({ obs }: { obs: CaregiverObservation }) {
  return (
    <AivoCard style={{ marginBottom: spacing.sm }}>
      <View style={styles.rowHeader}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryBadgeText}>{obs.category || "General"}</Text>
        </View>
        <Text style={styles.rowDate}>{formatDate(obs.date ?? obs.createdAt)}</Text>
      </View>
      <Text style={styles.notes}>{obs.notes}</Text>
      {obs.mood ? (
        <Text style={styles.mood}>
          <Ionicons name="happy-outline" size={13} color={colors.textSecondary} /> {obs.mood}
        </Text>
      ) : null}
    </AivoCard>
  );
}

function formatDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
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
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    marginRight: 8,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 13, fontFamily: "Nunito-SemiBold", color: colors.textSecondary },
  chipTextActive: { color: colors.white },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.primary + "1A",
  },
  categoryBadgeText: { fontSize: 11, fontFamily: "Nunito-Bold", color: colors.primary },
  rowDate: { fontSize: 12, fontFamily: "Nunito-Regular", color: colors.textSecondary },
  notes: { fontSize: 14, fontFamily: "Nunito-Regular", color: colors.text, lineHeight: 20 },
  mood: {
    fontSize: 12,
    fontFamily: "Nunito-SemiBold",
    color: colors.textSecondary,
    marginTop: 6,
    textTransform: "capitalize",
  },
  errorCard: { alignItems: "center", paddingVertical: spacing.lg, gap: 4 },
  errorTitle: {
    fontSize: 16,
    fontFamily: "Nunito-Bold",
    color: colors.text,
    marginTop: 8,
    textAlign: "center",
  },
  errorBody: {
    fontSize: 13,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    textAlign: "center",
  },
});
