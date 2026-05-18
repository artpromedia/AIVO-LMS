/**
 * Mobile counterpart of `apps/web/src/app/dashboard/therapist/sessions/page.tsx`.
 *
 * Two-tab UX (History / Log) for documenting therapy sessions against
 * a connected learner. Endpoints mirrored 1:1 with the web page so
 * either client can read the other's writes:
 *
 *   GET  /api/family/collaboration/connected-learners
 *   GET  /api/learning/sessions?learnerId=…    → SessionEntry[]
 *   POST /api/learning/sessions
 *        { learnerId, tutorSku: `therapy-${category}`,
 *          topic: notes.slice(0,100) || `${category} session`,
 *          contentType: 'THERAPY_SESSION',
 *          sessionDate: 'YYYY-MM-DD',
 *          durationMinutes: number }
 *
 * `sessionDate` and `durationMinutes` are honoured by learning-svc as of
 * Phase 4 (backend gaps) — the row is inserted with `started_at` and
 * `duration_seconds` set so the history reflects when the documented
 * session actually happened.
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useConnectedLearners } from "@/hooks/useFamily";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";
import { AivoButton, AivoCard, EmptyState, LoadingState } from "@aivo/mobile-ui";
import { colors, spacing, radius } from "@/constants/colors";

interface ConnectedLearner {
  id: string;
  name: string;
  functioningLevel: string | null;
  gradeLevel: string | null;
}

interface SessionEntry {
  id: string;
  learnerId: string;
  subject: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  durationSeconds?: number;
  xpEarned?: number;
  tutorSku: string;
  contentType: string;
}

type Tab = "history" | "log";
type Category = "speech" | "occupational" | "behavioral" | "physical" | "sel" | "other";
const CATEGORIES: Category[] = ["speech", "occupational", "behavioral", "physical", "sel", "other"];

function formatDuration(seconds: number | undefined, t: (k: string) => string): string {
  if (!seconds) return "—";
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function statusTone(status: string): { bg: string; fg: string } {
  if (status === "COMPLETED") return { bg: colors.success + "22", fg: colors.success };
  if (status === "CONTENT_READY") return { bg: colors.info + "22", fg: colors.info };
  return { bg: colors.warning + "22", fg: colors.warning };
}

export default function TherapistSessionsScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const {
    data: clientsRaw,
    isLoading: clientsLoading,
    error: clientsError,
    refetch,
  } = useConnectedLearners();
  const clients: ConnectedLearner[] = useMemo(
    () => (Array.isArray(clientsRaw) ? clientsRaw : []),
    [clientsRaw],
  );

  const [tab, setTab] = useState<Tab>("history");
  const [selectedLearner, setSelectedLearner] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const [logCategory, setLogCategory] = useState<Category>("speech");
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [logDuration, setLogDuration] = useState("30");
  const [logNotes, setLogNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  // Default the picker to the first connected learner.
  useEffect(() => {
    if (!selectedLearner && clients.length > 0) {
      setSelectedLearner(clients[0].id);
    }
  }, [clients, selectedLearner]);

  // Load history whenever the selected learner changes.
  useEffect(() => {
    if (!selectedLearner) {
      setSessions([]);
      return;
    }
    let cancelled = false;
    setSessionsLoading(true);
    apiFetch(
      API.LEARNING,
      `/api/learning/sessions?learnerId=${encodeURIComponent(selectedLearner)}`,
    )
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (cancelled) return;
        setSessions(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setSessions([]);
      })
      .finally(() => {
        if (!cancelled) setSessionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedLearner]);

  const selectedLearnerName = useMemo(() => {
    return clients.find((c) => c.id === selectedLearner)?.name ?? "";
  }, [clients, selectedLearner]);

  const handleLogSession = async () => {
    if (!selectedLearner) return;
    setSubmitting(true);
    setSubmitMsg(null);
    try {
      const res = await apiFetch(API.LEARNING, "/api/learning/sessions", {
        method: "POST",
        body: JSON.stringify({
          learnerId: selectedLearner,
          tutorSku: `therapy-${logCategory}`,
          topic: logNotes.slice(0, 100) || `${logCategory} session`,
          contentType: "THERAPY_SESSION",
          sessionDate: logDate,
          durationMinutes: parseInt(logDuration, 10) || undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSubmitMsg({ type: "success", text: t("therapistSessions.logSuccess") });
      setLogNotes("");
      // Refresh history so the just-logged session appears.
      const r2 = await apiFetch(
        API.LEARNING,
        `/api/learning/sessions?learnerId=${encodeURIComponent(selectedLearner)}`,
      );
      const updated = r2.ok ? await r2.json() : [];
      setSessions(Array.isArray(updated) ? updated : []);
    } catch {
      setSubmitMsg({ type: "error", text: t("therapistSessions.logError") });
    } finally {
      setSubmitting(false);
    }
  };

  if (clientsLoading) return <LoadingState />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: 32,
        paddingHorizontal: spacing.md,
      }}
    >
      <Text style={styles.title}>{t("therapistSessions.title")}</Text>

      {clientsError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{t("therapistSessions.loadError")}</Text>
          <AivoButton
            title={t("common.retry")}
            onPress={() => refetch()}
            variant="outline"
            style={{ marginTop: spacing.sm }}
          />
        </View>
      ) : clients.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="calendar-outline" size={48} color={colors.textSecondary} />}
          title={t("therapistSessions.noClientsTitle")}
          message={t("therapistSessions.noClientsMessage")}
        />
      ) : (
        <>
          {/* Learner picker — chip row, since RN has no native <select>. */}
          <Text style={styles.sectionLabel}>{t("therapistSessions.selectClient")}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {clients.map((c) => {
              const active = c.id === selectedLearner;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setSelectedLearner(c.id)}
                  style={[styles.chip, active && styles.chipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Tabs */}
          <View style={styles.tabsRow} accessibilityRole="tablist">
            {(["history", "log"] as const).map((value) => {
              const active = tab === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setTab(value)}
                  style={[styles.tabBtn, active && styles.tabBtnActive]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>
                    {value === "history"
                      ? t("therapistSessions.historyTab")
                      : t("therapistSessions.logTab")}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {tab === "history" ? (
            sessionsLoading ? (
              <View style={{ paddingVertical: spacing.xl }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : sessions.length === 0 ? (
              <EmptyState
                icon={<Ionicons name="time-outline" size={40} color={colors.textSecondary} />}
                title={t("therapistSessions.emptyHistoryTitle")}
                message={t("therapistSessions.emptyHistoryMessage", { name: selectedLearnerName })}
              />
            ) : (
              sessions.map((s) => {
                const tone = statusTone(s.status);
                return (
                  <AivoCard key={s.id} style={styles.sessionCard}>
                    <View style={styles.sessionHeader}>
                      <Text style={styles.sessionSubject}>{s.subject}</Text>
                      <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                        <Text style={[styles.badgeText, { color: tone.fg }]}>
                          {s.status.replace(/_/g, " ")}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.sessionMeta}>
                      {new Date(s.startedAt).toLocaleDateString()}
                      {" • "}
                      {s.contentType}
                      {" • "}
                      {formatDuration(s.durationSeconds, t)}
                    </Text>
                  </AivoCard>
                );
              })
            )
          ) : (
            <AivoCard style={styles.formCard}>
              <Text style={styles.formTitle}>{t("therapistSessions.logFormTitle")}</Text>

              <Text style={styles.label}>{t("therapistSessions.category")}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {CATEGORIES.map((c) => {
                  const active = logCategory === c;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setLogCategory(c)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {t(`therapistSessions.category_${c}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: spacing.sm }}>
                  <Text style={styles.label}>{t("therapistSessions.date")}</Text>
                  <TextInput
                    style={styles.input}
                    value={logDate}
                    onChangeText={setLogDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textSecondary}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <View style={{ width: 110 }}>
                  <Text style={styles.label}>{t("therapistSessions.durationMin")}</Text>
                  <TextInput
                    style={styles.input}
                    value={logDuration}
                    onChangeText={setLogDuration}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={styles.label}>{t("therapistSessions.notes")}</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={logNotes}
                onChangeText={setLogNotes}
                placeholder={t("therapistSessions.notesPlaceholder")}
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={4}
              />

              {submitMsg && (
                <Text
                  style={[
                    styles.submitMsg,
                    {
                      color: submitMsg.type === "success" ? colors.success : colors.error,
                      backgroundColor:
                        (submitMsg.type === "success" ? colors.success : colors.error) + "12",
                    },
                  ]}
                  accessibilityRole="alert"
                >
                  {submitMsg.text}
                </Text>
              )}

              <AivoButton
                title={submitting ? t("common.saving") : t("therapistSessions.logSubmit")}
                onPress={handleLogSession}
                loading={submitting}
                disabled={submitting || !selectedLearner}
                size="lg"
                style={{ marginTop: spacing.md }}
              />
            </AivoCard>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: {
    fontSize: 24,
    fontFamily: "Nunito-ExtraBold",
    color: colors.text,
    marginBottom: spacing.md,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: "Nunito-SemiBold",
    color: colors.textSecondary,
    marginBottom: 6,
  },
  chipRow: { gap: 8, paddingVertical: 4, paddingRight: spacing.md },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontFamily: "Nunito-SemiBold", color: colors.text },
  chipTextActive: { color: "#fff" },
  tabsRow: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    marginVertical: spacing.md,
  },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.md, alignItems: "center" },
  tabBtnActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 14, fontFamily: "Nunito-SemiBold", color: colors.textSecondary },
  tabTextActive: { color: "#fff" },
  sessionCard: { marginBottom: spacing.sm },
  sessionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  sessionSubject: { fontSize: 15, fontFamily: "Nunito-Bold", color: colors.text },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  badgeText: { fontSize: 11, fontFamily: "Nunito-Bold", textTransform: "uppercase" },
  sessionMeta: { fontSize: 12, fontFamily: "Nunito-Regular", color: colors.textSecondary },
  formCard: { padding: spacing.md },
  formTitle: {
    fontSize: 16,
    fontFamily: "Nunito-Bold",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: 13,
    fontFamily: "Nunito-SemiBold",
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: 6,
  },
  row: { flexDirection: "row" },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    fontFamily: "Nunito-Regular",
    color: colors.text,
    backgroundColor: colors.surface,
  },
  textarea: { height: 96, paddingTop: 10, textAlignVertical: "top" },
  submitMsg: {
    fontSize: 13,
    fontFamily: "Nunito-SemiBold",
    padding: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  errorBox: {
    padding: spacing.md,
    backgroundColor: colors.error + "10",
    borderRadius: radius.md,
  },
  errorText: { fontSize: 14, fontFamily: "Nunito-SemiBold", color: colors.error },
});
