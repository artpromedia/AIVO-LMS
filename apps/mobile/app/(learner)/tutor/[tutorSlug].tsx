import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Speech from "expo-speech";
import { useLocalSearchParams, router, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { useLearnerEntitlements } from "@/hooks/useLearnerEntitlements";
import { useEndSession, useSendMessage, useStartSession } from "@/hooks/useTutor";
import { useSpeechInput } from "@/hooks/useSpeechInput";
import { TUTORS } from "@aivo/brand";
import { TUTOR_KEY_TO_SKU, isTutorKey } from "@aivo/billing-entitlements";
import { colors, spacing, radius } from "@/constants/colors";
import { useWindowSizeClass } from "@/src/design/useWindowSizeClass";
import { CONTENT_MAX_WIDTH, pickBySizeClass } from "@/src/design/responsive";
import { sessionClient, TutorNotEntitledError } from "@/src/api/sessionClient";

type TutorKey = keyof typeof TUTORS;
type ChatTurn = { id: string; role: "learner" | "tutor"; text: string };

export default function TutorSessionScreen() {
  const { tutorSlug } = useLocalSearchParams<{ tutorSlug: string }>();
  const insets = useSafeAreaInsets();
  const tutorKey = isTutorKey(tutorSlug as string) ? (tutorSlug as TutorKey) : null;
  const tutor = tutorKey ? TUTORS[tutorKey] : undefined;
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { isTutorEntitled, isLoading: entitlementsLoading } = useLearnerEntitlements(
    user?.tenantId,
  );
  const entitled = isTutorEntitled(tutorSlug as string);
  const { sizeClass, width: winWidth } = useWindowSizeClass();
  const hPad = pickBySizeClass(sizeClass, {
    compact: spacing.md,
    medium: spacing.lg,
    expanded: spacing.xl,
  });
  const contentWidth = Math.min(winWidth - hPad * 2, CONTENT_MAX_WIDTH.reading);

  const startTutor = useStartSession();
  const sendMessage = useSendMessage();
  const endTutor = useEndSession();
  const scrollRef = useRef<ScrollView>(null);
  const [structuredStarting, setStructuredStarting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const speechInput = useSpeechInput({
    locale: i18n.language,
    onResult: setInput,
    onError: () =>
      Alert.alert(
        t("common.error", "Something went wrong"),
        t("learnerTutor.voiceError", "I could not hear that. Try again or type your question."),
      ),
  });

  if (!tutor || !tutorKey) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16, paddingHorizontal: hPad }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </Pressable>
        <Text style={styles.title}>{t("learnerTutor.tutorNotFound", "Tutor not found")}</Text>
      </View>
    );
  }

  const tutorSku = TUTOR_KEY_TO_SKU[tutorKey];

  const startGuidance = async () => {
    if (!user) return;
    try {
      const result = await startTutor.mutateAsync({
        learnerId: user.id,
        tutorSku,
        sessionType: "agentic_guidance",
      });
      const greeting = t(
        "learnerTutor.agenticGreeting",
        "Hi! I can guide you through any topic in {{domain}}. What would you like to explore?",
        { domain: tutor.domain },
      );
      setSessionId(result.sessionId);
      setTurns([{ id: "greeting", role: "tutor", text: greeting }]);
      if (autoSpeak) Speech.speak(greeting, { language: i18n.language });
    } catch (err) {
      Alert.alert(
        t("common.error", "Something went wrong"),
        err instanceof Error ? err.message : t("learnerTutor.startError", "Could not start guidance."),
      );
    }
  };

  const send = async () => {
    const message = input.trim();
    if (!sessionId || !message || sendMessage.isPending) return;
    setInput("");
    setTurns((current) => [
      ...current,
      { id: `learner-${Date.now()}`, role: "learner", text: message },
    ]);
    try {
      const result = await sendMessage.mutateAsync({
        sessionId,
        message,
        locale: i18n.language,
      });
      setTurns((current) => [
        ...current,
        { id: `tutor-${Date.now()}`, role: "tutor", text: result.response },
      ]);
      if (autoSpeak) Speech.speak(result.response, { language: i18n.language });
    } catch (err) {
      setTurns((current) => [
        ...current,
        {
          id: `error-${Date.now()}`,
          role: "tutor",
          text:
            err instanceof Error
              ? err.message
              : t("learnerTutor.replyError", "I could not answer just now. Please try again."),
        },
      ]);
    }
  };

  const endGuidance = async () => {
    if (!sessionId) return;
    try {
      await endTutor.mutateAsync({ sessionId });
      Speech.stop();
      setSessionId(null);
      setTurns([]);
      setInput("");
    } catch (err) {
      Alert.alert(
        t("common.error", "Something went wrong"),
        err instanceof Error ? err.message : t("learnerTutor.endError", "Could not end guidance."),
      );
    }
  };

  const startStructuredLesson = async () => {
    if (!user) return;
    setStructuredStarting(true);
    try {
      const { sessionId: lessonSessionId } = await sessionClient.startSession({
        learnerId: user.id,
        tutorSku,
      });
      router.push(`/(learner)/stage/${lessonSessionId}` as Href);
    } catch (err) {
      if (err instanceof TutorNotEntitledError) {
        Alert.alert(
          t("learnerTutor.lockedTitle", "Tutor locked"),
          t(
            "learnerTutor.lockedBody",
            "This tutor is not included in your current plan. Ask a parent or guardian to unlock it.",
          ),
        );
      } else {
        Alert.alert(
          t("common.error", "Something went wrong"),
          err instanceof Error ? err.message : t("learnerTutor.startError", "Could not start lesson."),
        );
      }
    } finally {
      setStructuredStarting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: hPad, flex: 1 }}>
        <View style={[styles.content, { width: contentWidth }]}>
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => router.back()}
              style={styles.backRow}
              accessibilityRole="button"
              accessibilityLabel={t("common.back", "Back")}
            >
              <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.8)" />
              <Text style={styles.backText}>{t("common.back", "Back")}</Text>
            </Pressable>
            {sessionId ? (
              <Pressable
                onPress={endGuidance}
                disabled={endTutor.isPending}
                style={styles.endButton}
                accessibilityRole="button"
              >
                <Text style={styles.endButtonText}>{t("learnerTutor.end", "End")}</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.tutorIntro}>
            <View style={[styles.tutorAvatar, { backgroundColor: tutor.color + "30" }]}>
              <Text style={styles.tutorIcon}>{tutor.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tutorName}>{tutor.name}</Text>
              <Text style={styles.tutorDomain}>{tutor.domain}</Text>
              <Text style={styles.scopeText}>
                {t("learnerTutor.scope", "Agentic guidance for PRE-K through grade 12")}
              </Text>
            </View>
          </View>

          {!sessionId ? (
            <ScrollView contentContainerStyle={styles.landing}>
              <View style={styles.sessionInfo}>
                <InfoCard
                  icon="chatbubbles-outline"
                  color={colors.primaryLight}
                  text={t(
                    "learnerTutor.domainGuidance",
                    "Ask questions and get step-by-step guidance in this tutor's domain.",
                  )}
                />
                <InfoCard
                  icon="mic-outline"
                  color={colors.accent}
                  text={t(
                    "learnerTutor.multimodal",
                    "Use voice or text. Responses can be read aloud for early learners.",
                  )}
                />
                <InfoCard
                  icon="shield-checkmark-outline"
                  color={colors.success}
                  text={t(
                    "learnerTutor.guidanceBoundary",
                    "Guidance adapts to the learner; formal mastery still uses reviewed lessons.",
                  )}
                />
              </View>

              {!entitled && !entitlementsLoading ? (
                <View style={styles.lockedCallout} accessibilityLiveRegion="polite">
                  <Ionicons name="lock-closed" size={18} color="#FFF" />
                  <Text style={styles.lockedText}>
                    {t(
                      "learnerTutor.lockedBody",
                      "This tutor is not included in your current plan. Ask a parent or guardian to unlock it.",
                    )}
                  </Text>
                </View>
              ) : null}

              <Pressable
                onPress={startGuidance}
                disabled={!entitled || startTutor.isPending}
                style={[
                  styles.primaryButton,
                  { backgroundColor: tutor.color, opacity: entitled ? 1 : 0.5 },
                ]}
                accessibilityRole="button"
              >
                {startTutor.isPending ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="chatbubbles" size={20} color="#FFF" />
                    <Text style={styles.primaryButtonText}>
                      {t("learnerTutor.startGuidance", "Start guided conversation")}
                    </Text>
                  </>
                )}
              </Pressable>

              <Pressable
                onPress={startStructuredLesson}
                disabled={!entitled || structuredStarting}
                style={[styles.secondaryButton, { opacity: entitled ? 1 : 0.5 }]}
                accessibilityRole="button"
              >
                {structuredStarting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="play" size={18} color="#FFF" />
                    <Text style={styles.secondaryButtonText}>
                      {t("learnerTutor.startLesson", "Start structured lesson")}
                    </Text>
                  </>
                )}
              </Pressable>
            </ScrollView>
          ) : (
            <>
              <ScrollView
                ref={scrollRef}
                style={styles.chat}
                contentContainerStyle={styles.chatContent}
                onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
                keyboardShouldPersistTaps="handled"
              >
                {turns.map((turn) => (
                  <View
                    key={turn.id}
                    style={[
                      styles.bubble,
                      turn.role === "learner" ? styles.learnerBubble : styles.tutorBubble,
                    ]}
                  >
                    <Text style={styles.bubbleText}>{turn.text}</Text>
                    {turn.role === "tutor" ? (
                      <Pressable
                        onPress={() => Speech.speak(turn.text, { language: i18n.language })}
                        accessibilityRole="button"
                        accessibilityLabel={t("learnerTutor.readAloud", "Read response aloud")}
                        style={styles.speakButton}
                      >
                        <Ionicons name="volume-high-outline" size={17} color="#FFF" />
                      </Pressable>
                    ) : null}
                  </View>
                ))}
                {sendMessage.isPending ? (
                  <View style={[styles.bubble, styles.tutorBubble]}>
                    <ActivityIndicator color="#FFF" />
                  </View>
                ) : null}
              </ScrollView>

              <View style={styles.chatControls}>
                <Pressable
                  onPress={() => setAutoSpeak((current) => !current)}
                  style={[styles.iconButton, autoSpeak && { backgroundColor: tutor.color }]}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: autoSpeak }}
                  accessibilityLabel={t("learnerTutor.autoSpeak", "Read tutor replies aloud")}
                >
                  <Ionicons
                    name={autoSpeak ? "volume-high" : "volume-mute-outline"}
                    size={20}
                    color="#FFF"
                  />
                </Pressable>
                {speechInput.isSupported ? (
                  <Pressable
                    onPress={
                      speechInput.status === "listening" ? speechInput.stop : speechInput.start
                    }
                    disabled={speechInput.status === "processing"}
                    style={[
                      styles.iconButton,
                      speechInput.status === "listening" && { backgroundColor: colors.error },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={
                      speechInput.status === "listening"
                        ? t("learnerTutor.stopListening", "Stop listening")
                        : t("learnerTutor.speakQuestion", "Speak your question")
                    }
                  >
                    {speechInput.status === "processing" ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <Ionicons
                        name={speechInput.status === "listening" ? "stop" : "mic"}
                        size={20}
                        color="#FFF"
                      />
                    )}
                  </Pressable>
                ) : null}
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  onSubmitEditing={send}
                  placeholder={t("learnerTutor.prompt", "Ask about this subject...")}
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  style={styles.input}
                  multiline
                  accessibilityLabel={t("learnerTutor.prompt", "Ask about this subject")}
                />
                <Pressable
                  onPress={send}
                  disabled={!input.trim() || sendMessage.isPending}
                  style={[styles.sendButton, { backgroundColor: tutor.color }]}
                  accessibilityRole="button"
                  accessibilityLabel={t("learnerTutor.send", "Send")}
                >
                  <Ionicons name="arrow-up" size={22} color="#FFF" />
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function InfoCard({ icon, color, text }: { icon: keyof typeof Ionicons.glyphMap; color: string; text: string }) {
  return (
    <View style={styles.infoCard}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1A1A2E" },
  content: { flex: 1, alignSelf: "center" },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  backRow: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44 },
  backText: { fontSize: 16, fontFamily: "Nunito-SemiBold", color: "rgba(255,255,255,0.8)" },
  endButton: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  endButtonText: { color: "#FFF", fontFamily: "Nunito-Bold" },
  title: { fontSize: 24, fontFamily: "Nunito-ExtraBold", color: "#FFF", marginTop: spacing.md },
  tutorIntro: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  tutorAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  tutorIcon: { fontSize: 34 },
  tutorName: { fontSize: 24, fontFamily: "Nunito-ExtraBold", color: "#FFF" },
  tutorDomain: { fontSize: 14, fontFamily: "Nunito-SemiBold", color: "rgba(255,255,255,0.75)" },
  scopeText: {
    fontSize: 12,
    fontFamily: "Nunito-SemiBold",
    color: "rgba(255,255,255,0.55)",
    marginTop: 3,
  },
  landing: { paddingBottom: spacing.xl },
  sessionInfo: { gap: 12 },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: radius.xl,
    padding: spacing.md,
  },
  infoText: { flex: 1, fontSize: 14, lineHeight: 20, fontFamily: "Nunito-SemiBold", color: "#FFF" },
  lockedCallout: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: "rgba(255, 200, 0, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(255, 200, 0, 0.6)",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  lockedText: { flex: 1, fontSize: 14, fontFamily: "Nunito-SemiBold", color: "#FFF" },
  primaryButton: {
    minHeight: 54,
    marginTop: spacing.xl,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  primaryButtonText: { color: "#FFF", fontSize: 16, fontFamily: "Nunito-Bold" },
  secondaryButton: {
    minHeight: 50,
    marginTop: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  secondaryButtonText: { color: "#FFF", fontSize: 15, fontFamily: "Nunito-Bold" },
  chat: { flex: 1 },
  chatContent: { paddingVertical: spacing.sm, gap: spacing.sm },
  bubble: {
    maxWidth: "88%",
    borderRadius: radius.xl,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  tutorBubble: { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.12)" },
  learnerBubble: { alignSelf: "flex-end", backgroundColor: "rgba(124,58,237,0.8)" },
  bubbleText: { flexShrink: 1, color: "#FFF", fontFamily: "Nunito-SemiBold", fontSize: 15, lineHeight: 21 },
  speakButton: { padding: 3 },
  chatControls: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xs,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    borderRadius: 22,
    color: "#FFF",
    backgroundColor: "rgba(255,255,255,0.1)",
    fontFamily: "Nunito-SemiBold",
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
