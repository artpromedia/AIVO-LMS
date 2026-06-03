import React from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useLearnerLiveSessions, isLiveSession } from "@/hooks/useGradebook";
import { useSse } from "@/hooks/useSse";
import { getToken } from "@/lib/api";
import { API } from "@/constants/api";
import { EmptyState } from "@aivo/mobile-ui";
import { colors, spacing, radius } from "@/constants/colors";

function fmtTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function fmtDuration(sec?: number | null): string | null {
  if (sec == null || sec <= 0) return null;
  const m = Math.round(sec / 60);
  return m < 1 ? "<1 min" : `${m} min`;
}

/**
 * Live view of a learner's current/most-recent session, polled every 6s.
 * Shows an "Active now" state while a session is in progress so a parent can
 * follow along (co-view / co-learn), and the last session otherwise.
 */
export function LearnerLiveSessionCard({ learnerId }: { learnerId: string }) {
  const { data, isLoading } = useLearnerLiveSessions(learnerId);
  const latest = data?.[0] ?? null;
  const live = isLiveSession(latest);

  // Cross-replica SSE fan-out on `session.coview.<learnerId>` — push
  // arrives from whichever learning-svc replica wrote the session row.
  // We don't merge state locally; we just invalidate react-query so the
  // existing `useLearnerLiveSessions` hook refetches against the
  // authoritative GET. The hook's `refetchInterval` polling remains in
  // place as the documented fallback (it's a no-op when the cache was
  // freshly invalidated, but takes over if the stream errors).
  const queryClient = useQueryClient();
  const [bearer, setBearer] = React.useState<string | null>(null);
  React.useEffect(() => {
    let alive = true;
    void getToken().then((t) => {
      if (alive) setBearer(t);
    });
    return () => {
      alive = false;
    };
  }, [learnerId]);
  useSse(`${API.LEARNING}/api/learning/sessions/${learnerId}/stream`, {
    bearer,
    enabled: !!learnerId && !!bearer,
    onMessage: () => {
      void queryClient.invalidateQueries({ queryKey: ["lesson-sessions-live", learnerId] });
    },
  });

  if (isLoading) {
    return <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />;
  }

  if (!latest) {
    return (
      <EmptyState
        icon={<Ionicons name="time-outline" size={48} color={colors.textSecondary} />}
        title="No recent activity"
        message="When your child starts a lesson, it will appear here."
      />
    );
  }

  const meta = fmtDuration(latest.durationSeconds);

  return (
    <View style={[styles.card, live && styles.cardLive]}>
      <View style={styles.headerRow}>
        <View style={[styles.dot, { backgroundColor: live ? "#22c55e" : colors.border }]} />
        <Text style={[styles.status, { color: live ? "#16a34a" : colors.textSecondary }]}>
          {live ? "Active now" : "Last session"}
        </Text>
      </View>
      <Text style={styles.subject}>{latest.subject}</Text>
      <View style={styles.metaRow}>
        {latest.xpEarned != null ? <Text style={styles.meta}>{latest.xpEarned} XP</Text> : null}
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        <Text style={styles.meta}>
          {live
            ? `Started ${fmtTime(latest.startedAt)}`
            : `Finished ${fmtTime(latest.completedAt)}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  cardLive: { borderColor: "#22c55e" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  status: {
    fontSize: 12,
    fontFamily: "Nunito-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  subject: { fontSize: 20, fontFamily: "Nunito-ExtraBold", color: colors.text, marginTop: 4 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 4 },
  meta: { fontSize: 13, fontFamily: "Nunito-SemiBold", color: colors.textSecondary },
});
