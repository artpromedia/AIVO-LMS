import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useSpeechInput } from "@/hooks/useSpeechInput";
import {
  useHomeworkSessionState,
  useSendHomeworkMessage,
  useCompleteHomeworkSession,
  type AdaptedProblem,
  type HomeworkChatMessage,
} from "@/hooks/useHomework";
import { AivoCard } from "@aivo/mobile-ui";
import { colors, spacing, radius } from "@/constants/colors";
import { useWindowSizeClass } from "@/src/design/useWindowSizeClass";
import { HomeworkWorkspace } from "@/src/components/learning/HomeworkWorkspace";
import { ScratchPad } from "@/src/components/learning/ScratchPad";
import { useCalmNudge } from "@/hooks/useCalmNudge";

type DisplayMessage = HomeworkChatMessage & { _localId: string };

// Mirror the BCP-47 mapping used by the web homework chat in
// apps/web/src/app/dashboard/learner/homework/[sessionId]/page.tsx.
const STT_LOCALE_MAP: Record<string, string> = {
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  pt: "pt-BR",
  zh: "zh-CN",
  ja: "ja-JP",
  ko: "ko-KR",
  ar: "ar-SA",
  hi: "hi-IN",
};

function makeGreeting(
  problems: AdaptedProblem[],
  greetingFallback: string,
  greetingWith: (n: number, first: number) => string,
): string {
  if (problems.length === 0) return greetingFallback;
  const first = problems[0]?.problem_number ?? 1;
  return greetingWith(problems.length, first);
}

export default function HomeworkSessionScreen() {
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ sessionId: string }>();
  const sessionId = params.sessionId ?? "";
  const { isTablet, sizeClass } = useWindowSizeClass();

  const { data, isLoading, error } = useHomeworkSessionState(sessionId);
  const sendMessage = useSendHomeworkMessage(sessionId);
  const complete = useCompleteHomeworkSession(sessionId);

  // Local-only calm nudge: watches inactivity + rapid resends and offers a
  // gentle, dismissible link into the Calm Corner when the learner seems
  // stuck. Mirrors the web homework chat's focus monitor.
  const calm = useCalmNudge();

  const [input, setInput] = useState("");
  const [localMessages, setLocalMessages] = useState<DisplayMessage[]>([]);
  const [completedProblems, setCompletedProblems] = useState<Set<number>>(new Set());
  const [showProblems, setShowProblems] = useState(true);
  const listRef = useRef<FlatList<DisplayMessage>>(null);
  const seededRef = useRef(false);

  // Mirror web's BCP-47 mapping in
  // apps/web/src/app/dashboard/learner/homework/[sessionId]/page.tsx so the
  // ai-svc transcribe call gets the same locale hint on both platforms.
  const sttLocale = STT_LOCALE_MAP[i18n.language] || "en-US";
  const speech = useSpeechInput({
    locale: sttLocale,
    onResult: (text) => {
      setInput((prev) => (prev ? `${prev} ${text}` : text));
    },
  });

  const adaptedProblems = data?.adaptedProblems ?? [];
  const subject = (data?.subject || "other").toLowerCase();

  // Seed local messages from server state. If the server has none, inject a
  // greeting that mirrors the web client's behaviour so the chat doesn't
  // start empty.
  useEffect(() => {
    if (!data || seededRef.current) return;
    seededRef.current = true;
    const existing = data.messages ?? [];
    if (existing.length > 0) {
      setLocalMessages(existing.map((m, i) => ({ ...m, _localId: `srv-${i}` })));
    } else {
      const greeting = makeGreeting(
        data.adaptedProblems,
        t("learnerHomeworkSession.greetingNoProblems"),
        (count, first) => t("learnerHomeworkSession.greetingWithProblems", { count, first }),
      );
      setLocalMessages([
        {
          role: "assistant",
          content: greeting,
          timestamp: new Date().toISOString(),
          _localId: "greet-0",
        },
      ]);
    }
  }, [data, t]);

  useEffect(() => {
    if (localMessages.length === 0) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [localMessages.length]);

  const onSend = async () => {
    const text = input.trim();
    if (!text || sendMessage.isPending) return;
    setInput("");
    calm.noteSend();
    const now = new Date().toISOString();
    setLocalMessages((prev) => [
      ...prev,
      { role: "user", content: text, timestamp: now, _localId: `u-${Date.now()}` },
    ]);
    try {
      const result = await sendMessage.mutateAsync({
        message: text,
        locale: i18n.language,
      });
      setLocalMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.response,
          timestamp: new Date().toISOString(),
          _localId: `a-${Date.now()}`,
        },
      ]);
    } catch {
      setLocalMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: t("learnerHomeworkSession.sendError"),
          timestamp: new Date().toISOString(),
          _localId: `err-${Date.now()}`,
        },
      ]);
    }
  };

  const onMarkProblemDone = (num: number) => {
    setCompletedProblems((prev) => {
      if (prev.has(num)) return prev;
      const next = new Set(prev);
      next.add(num);
      return next;
    });
  };

  const onComplete = async () => {
    try {
      await complete.mutateAsync({
        problemsAttempted: adaptedProblems.length,
        problemsCompleted: completedProblems.size,
      });
      router.back();
    } catch {
      Alert.alert(t("learnerHomeworkSession.title"), t("learnerHomeworkSession.completeError"));
    }
  };

  const headerLabel = useMemo(() => {
    if (adaptedProblems.length === 0) return null;
    return t("learnerHomeworkSession.progress", {
      done: completedProblems.size,
      total: adaptedProblems.length,
    });
  }, [adaptedProblems.length, completedProblems.size, t]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.errorText}>{t("learnerHomeworkSession.notFound")}</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button">
          <Text style={styles.backBtnText}>{t("common.back")}</Text>
        </Pressable>
      </View>
    );
  }

  // Header is shared between the phone (top of screen) and tablet
  // (above the HomeworkWorkspace 3-pane shell).
  const headerNode = (
    <View style={[styles.header, isTablet && styles.headerTablet]}>
      <Pressable
        onPress={() => router.back()}
        style={styles.backRow}
        accessibilityRole="button"
        accessibilityLabel={t("common.back")}
      >
        <Ionicons name="arrow-back" size={20} color={colors.primary} />
        <Text style={styles.backText}>{t("common.back")}</Text>
      </Pressable>
      <View style={styles.headerTitleRow}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {t("learnerHomeworkSession.subjectTitle", {
            subject: subject.charAt(0).toUpperCase() + subject.slice(1),
          })}
        </Text>
        {headerLabel ? <Text style={styles.headerMeta}>{headerLabel}</Text> : null}
      </View>
      {adaptedProblems.length > 0 ? (
        <Pressable
          onPress={() => setShowProblems((s) => !s)}
          style={styles.toggleBtn}
          accessibilityRole="button"
        >
          <Text style={styles.toggleText}>
            {showProblems
              ? t("learnerHomeworkSession.hideProblems")
              : t("learnerHomeworkSession.showProblems")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );

  const problemsNode =
    showProblems && adaptedProblems.length > 0 ? (
      <View style={[styles.problemsWrap, isTablet && styles.problemsWrapTablet]}>
        <ScrollView
          horizontal={!isTablet}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={isTablet ? styles.problemsColumn : styles.problemsRow}
        >
          {adaptedProblems.map((p) => {
            const done = completedProblems.has(p.problem_number);
            return (
              <AivoCard
                key={p.problem_number}
                style={[
                  styles.problemCard,
                  isTablet && styles.problemCardTablet,
                  done && styles.problemCardDone,
                ]}
              >
                <Text style={styles.problemNum}>
                  {t("learnerHomeworkSession.problemNumber", {
                    number: p.problem_number,
                  })}
                </Text>
                <Text style={styles.problemText} numberOfLines={4}>
                  {p.adapted || p.original}
                </Text>
                {p.scaffolding ? (
                  <Text style={styles.problemHint} numberOfLines={3}>
                    💡 {p.scaffolding}
                  </Text>
                ) : null}
                <Pressable
                  onPress={() => onMarkProblemDone(p.problem_number)}
                  disabled={done}
                  style={[styles.problemBtn, done && styles.problemBtnDone]}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name={done ? "checkmark-circle" : "ellipse-outline"}
                    size={16}
                    color={done ? colors.success : colors.primary}
                  />
                  <Text style={[styles.problemBtnText, done && styles.problemBtnTextDone]}>
                    {done ? t("learnerHomeworkSession.done") : t("learnerHomeworkSession.markDone")}
                  </Text>
                </Pressable>
              </AivoCard>
            );
          })}
        </ScrollView>
      </View>
    ) : null;

  const chatNode = (
    <View style={styles.chatFlex}>
      <FlatList
        ref={listRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        data={localMessages}
        keyExtractor={(m) => m._localId}
        renderItem={({ item }) => <MessageBubble message={item} />}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      />

      {sendMessage.isPending ? (
        <View style={styles.thinkingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.thinkingText}>{t("learnerHomeworkSession.thinking")}</Text>
        </View>
      ) : null}

      {calm.nudge ? (
        <View style={styles.nudgeCard} accessibilityLiveRegion="polite">
          <Text style={styles.nudgeTitle}>{t("learnerCalm.nudge.title")}</Text>
          <Text style={styles.nudgeBody}>{t("learnerCalm.nudge.body")}</Text>
          <View style={styles.nudgeActions}>
            <Pressable
              onPress={() => {
                const action = calm.nudge?.recommendedAction ?? "offer_break";
                calm.dismiss();
                router.push(`/(learner)/calm?action=${action}` as never);
              }}
              accessibilityRole="button"
              style={styles.nudgeAccept}
            >
              <Text style={styles.nudgeAcceptText}>{t("learnerCalm.nudge.accept")}</Text>
            </Pressable>
            <Pressable
              onPress={() => calm.dismiss()}
              accessibilityRole="button"
              style={styles.nudgeDismiss}
            >
              <Text style={styles.nudgeDismissText}>{t("learnerCalm.nudge.dismiss")}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.composerRow}>
        <Pressable
          onPress={() => {
            if (speech.status === "listening") {
              speech.stop().catch(() => undefined);
            } else if (speech.status === "processing") {
              // ignore taps while uploading
            } else {
              speech.start().catch(() => undefined);
            }
          }}
          disabled={!speech.isSupported || sendMessage.isPending}
          style={[
            styles.micBtn,
            speech.status === "listening" && styles.micBtnRecording,
            (!speech.isSupported || sendMessage.isPending) && styles.micBtnDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            speech.status === "listening"
              ? t("learnerHomeworkSession.stopRecording")
              : t("learnerHomeworkSession.startRecording")
          }
          accessibilityState={{
            disabled: !speech.isSupported || sendMessage.isPending,
            busy: speech.status === "processing",
          }}
        >
          {speech.status === "processing" ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Ionicons
              name={speech.status === "listening" ? "square" : "mic"}
              size={18}
              color="#FFF"
            />
          )}
        </Pressable>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={t("learnerHomeworkSession.placeholder")}
          placeholderTextColor={colors.textSecondary}
          multiline
          accessibilityLabel={t("learnerHomeworkSession.placeholder")}
          editable={!sendMessage.isPending}
        />
        <Pressable
          onPress={onSend}
          disabled={!input.trim() || sendMessage.isPending}
          style={[
            styles.sendBtn,
            (!input.trim() || sendMessage.isPending) && styles.sendBtnDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t("learnerHomeworkSession.send")}
        >
          <Ionicons name="send" size={18} color="#FFF" />
        </Pressable>
      </View>

      {speech.error ? (
        <Text style={styles.sttError} accessibilityLiveRegion="polite">
          {t(`learnerHomeworkSession.sttError.${speech.error}`)}
        </Text>
      ) : null}

      <Pressable
        onPress={onComplete}
        disabled={complete.isPending}
        style={styles.completeBtn}
        accessibilityRole="button"
      >
        {complete.isPending ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <Text style={styles.completeBtnText}>{t("learnerHomeworkSession.finish")}</Text>
        )}
      </Pressable>
    </View>
  );

  if (isTablet) {
    // Three-pane tablet workspace: problems | scratchpad | chat.
    // Lets the learner solve on paper while the tutor stays visible.
    return (
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        <HomeworkWorkspace
          header={headerNode}
          problems={
            problemsNode ?? (
              <Text style={styles.helperText}>
                {t("learnerHomeworkSession.noProblems", {
                  defaultValue: "No adapted problems yet.",
                })}
              </Text>
            )
          }
          work={
            <View style={styles.workArea}>
              <Text style={styles.workTitle}>
                {t("learnerHomeworkSession.workTitle", { defaultValue: "Your work" })}
              </Text>
              <View style={styles.workPad}>
                <ScratchPad gridPaper={sizeClass === "expanded"} compactToolbar />
              </View>
            </View>
          }
          tutor={chatNode}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + 8 }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      {headerNode}
      {problemsNode}
      {chatNode}
    </KeyboardAvoidingView>
  );
}

function MessageBubble({ message }: { message: DisplayMessage }) {
  const isUser = message.role === "user";
  return (
    <View style={[styles.bubbleRow, { justifyContent: isUser ? "flex-end" : "flex-start" }]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        <Text
          style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant]}
        >
          {message.content}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
  },
  center: { alignItems: "center", justifyContent: "center" },
  header: { marginBottom: spacing.sm },
  headerTablet: { marginBottom: 0, paddingHorizontal: 0 },
  chatFlex: { flex: 1 },
  problemsWrapTablet: { marginBottom: 0, flex: 1 },
  problemsColumn: { gap: 8, paddingBottom: spacing.md },
  workArea: { flex: 1 },
  workTitle: {
    fontSize: 14,
    fontFamily: "Nunito-Bold",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  workPad: { flex: 1, minHeight: 240 },
  helperText: {
    fontSize: 13,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    textAlign: "center",
    paddingVertical: spacing.lg,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: spacing.sm,
  },
  backText: {
    fontSize: 16,
    fontFamily: "Nunito-SemiBold",
    color: colors.primary,
  },
  headerTitleRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Nunito-ExtraBold",
    color: colors.text,
    flex: 1,
  },
  headerMeta: {
    fontSize: 12,
    fontFamily: "Nunito-SemiBold",
    color: colors.textSecondary,
  },
  toggleBtn: { alignSelf: "flex-start", paddingVertical: 4 },
  toggleText: {
    fontSize: 12,
    fontFamily: "Nunito-Bold",
    color: colors.primary,
  },
  problemsWrap: { marginBottom: spacing.sm },
  problemsRow: { gap: 8, paddingRight: spacing.md },
  problemCard: {
    width: 240,
    padding: spacing.sm,
    gap: 6,
  },
  problemCardTablet: { width: "100%" },
  problemCardDone: { opacity: 0.7 },
  problemNum: {
    fontSize: 11,
    fontFamily: "Nunito-Bold",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  problemText: {
    fontSize: 13,
    fontFamily: "Nunito-SemiBold",
    color: colors.text,
  },
  problemHint: {
    fontSize: 12,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
  },
  problemBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
  },
  problemBtnDone: {},
  problemBtnText: {
    fontSize: 12,
    fontFamily: "Nunito-Bold",
    color: colors.primary,
  },
  problemBtnTextDone: { color: colors.success },
  messages: { flex: 1 },
  messagesContent: { gap: 8, paddingVertical: spacing.sm },
  bubbleRow: { flexDirection: "row" },
  bubble: {
    maxWidth: "80%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.lg,
  },
  bubbleUser: { backgroundColor: colors.primary },
  bubbleAssistant: { backgroundColor: colors.surface },
  bubbleText: { fontSize: 14, fontFamily: "Nunito-Regular", lineHeight: 20 },
  bubbleTextUser: { color: "#FFF" },
  bubbleTextAssistant: { color: colors.text },
  thinkingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
  },
  thinkingText: {
    fontSize: 12,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
  },
  nudgeCard: {
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primary + "0F",
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: 6,
  },
  nudgeTitle: { fontSize: 15, fontFamily: "Nunito-Bold", color: colors.text },
  nudgeBody: { fontSize: 13, fontFamily: "Nunito-Regular", color: colors.textSecondary },
  nudgeActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: 4 },
  nudgeAccept: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  nudgeAcceptText: { fontSize: 14, fontFamily: "Nunito-Bold", color: "#FFF" },
  nudgeDismiss: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  nudgeDismissText: { fontSize: 14, fontFamily: "Nunito-Bold", color: colors.text },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingVertical: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.text,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  micBtnRecording: {
    backgroundColor: colors.error,
  },
  micBtnDisabled: {
    opacity: 0.4,
  },
  sttError: {
    fontSize: 12,
    fontFamily: "Nunito-SemiBold",
    color: colors.error,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
  },
  completeBtn: {
    marginBottom: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.full,
    backgroundColor: colors.success,
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
  },
  completeBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontFamily: "Nunito-Bold",
  },
  errorText: {
    fontSize: 14,
    fontFamily: "Nunito-SemiBold",
    color: colors.error,
    marginBottom: spacing.md,
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
  },
  backBtnText: { color: "#FFF", fontSize: 14, fontFamily: "Nunito-Bold" },
});
