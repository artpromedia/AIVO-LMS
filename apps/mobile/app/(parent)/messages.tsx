/**
 * Sprint 13: Parent messages — mobile thread list.
 *
 * Each thread is scoped to one of the parent's own learners; comms-svc
 * enforces the visibility boundary so cross-learner threads cannot leak.
 */
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { colors, spacing, radius } from "@/constants/colors";
import { API } from "@/constants/api";
import { apiFetch } from "@/lib/api";

interface ThreadRow {
  id: string;
  kind: string;
  learnerId: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export default function ParentMessagesScreen() {
  const insets = useSafeAreaInsets();
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(API.COMMS, "/api/comms/threads");
        if (!res.ok) {
          setError("Could not load messages");
          setLoading(false);
          return;
        }
        const body = (await res.json()) as { threads?: ThreadRow[] };
        if (!cancelled) setThreads(body.threads ?? []);
      } catch {
        if (!cancelled) setError("Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      <Text style={styles.title}>Messages</Text>
      <Text style={styles.subtitle}>
        About your learners only — you won't see threads about other children.
      </Text>
      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.lg }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : threads.length === 0 ? (
        <Text style={styles.empty}>No conversations yet.</Text>
      ) : (
        <ScrollView style={{ marginTop: spacing.md }}>
          {threads.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => router.push(`/(parent)/messages-thread?id=${t.id}` as any)}
              style={styles.card}
            >
              <Text style={styles.cardTitle}>{t.kind.replace(/_/g, " ")}</Text>
              <Text style={styles.cardMeta}>
                {new Date(t.updatedAt ?? t.createdAt).toLocaleString()}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.md, backgroundColor: colors.bg },
  title: { fontSize: 24, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: spacing.xs },
  error: { color: colors.danger, marginTop: spacing.md },
  empty: { color: colors.textMuted, marginTop: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTitle: { fontSize: 16, fontWeight: "600", color: colors.text, textTransform: "capitalize" },
  cardMeta: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
});
