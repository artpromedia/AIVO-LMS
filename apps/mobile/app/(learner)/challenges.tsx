import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Share,
  Alert,
  TextInput,
  ActivityIndicator,
  Modal,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { useLearners } from "@/hooks/useLearners";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";
import { AivoCard, AivoButton } from "@aivo/mobile-ui";
import { colors, spacing, radius } from "@/constants/colors";

export default function ChallengesScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: learners } = useLearners();
  const learnerId = user?.role === "LEARNER" ? user.id : learners?.[0]?.id || "";

  const [creatingType, setCreatingType] = useState<string | null>(null);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [createdChallenge, setCreatedChallenge] = useState<{
    id: string;
    inviteCode: string;
    title: string;
  } | null>(null);

  const handleCreateChallenge = useCallback(
    async (type: string, title: string, subject?: string) => {
      if (!learnerId) {
        Alert.alert(t("common.error"), "No learner profile found.");
        return;
      }
      setCreatingType(type);
      try {
        const res = await apiFetch(API.ENGAGEMENT, "/api/engagement/challenges/create", {
          method: "POST",
          body: JSON.stringify({
            challengeType: type,
            subject,
            title,
            maxParticipants: type === "multiplayer" ? 4 : 2,
            createdBy: learnerId,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setCreatedChallenge({ id: data.id, inviteCode: data.inviteCode, title: data.title });
        } else {
          Alert.alert(t("common.error"), data.error || "Failed to create challenge");
        }
      } catch {
        Alert.alert(t("common.error"), "Network error. Please try again.");
      } finally {
        setCreatingType(null);
      }
    },
    [learnerId, t],
  );

  const handleJoinChallenge = useCallback(async () => {
    if (!learnerId || !joinCode.trim()) return;
    setJoining(true);
    try {
      const res = await apiFetch(API.ENGAGEMENT, "/api/engagement/challenges/join", {
        method: "POST",
        body: JSON.stringify({ inviteCode: joinCode.trim().toUpperCase(), learnerId }),
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert("🎮", "Joined challenge! Get ready to play.");
        setJoinModalVisible(false);
        setJoinCode("");
      } else {
        Alert.alert(t("common.error"), data.error || "Could not join challenge");
      }
    } catch {
      Alert.alert(t("common.error"), "Network error. Please try again.");
    } finally {
      setJoining(false);
    }
  }, [learnerId, joinCode, t]);

  const handleShareCode = useCallback(async (code: string) => {
    await Share.share({
      message: `Join my AIVO challenge! Use code: ${code}`,
    });
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32 }}
    >
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backRow}>
        <Ionicons name="arrow-back" size={20} color={colors.primary} />
        <Text style={styles.backText}>{t("common.back")}</Text>
      </Pressable>
      <Text style={styles.title}>{t("learnerChallenges.title")}</Text>
      <Text style={styles.subtitle}>{t("learnerChallenges.subtitle")}</Text>

      {createdChallenge && (
        <AivoCard style={[styles.battleCard, { borderWidth: 2, borderColor: colors.success }]}>
          <Ionicons name="checkmark-circle" size={28} color={colors.success} />
          <Text style={styles.battleTitle}>{createdChallenge.title}</Text>
          <Text style={styles.battleDesc}>Share this code with a friend to start!</Text>
          <View style={styles.codeBox}>
            <Text style={styles.codeText}>{createdChallenge.inviteCode}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8, marginTop: spacing.md }}>
            <AivoButton
              title={t("learnerChallenges.copyCode")}
              onPress={() => handleShareCode(createdChallenge.inviteCode)}
              variant="outline"
              size="sm"
            />
            <AivoButton title="Done" onPress={() => setCreatedChallenge(null)} size="sm" />
          </View>
        </AivoCard>
      )}

      <AivoCard style={styles.battleCard}>
        <Ionicons name="flash" size={32} color={colors.accent} />
        <Text style={styles.battleTitle}>{t("learnerChallenges.quickBattle")}</Text>
        <Text style={styles.battleDesc}>{t("learnerChallenges.quickBattleDesc")}</Text>
        {creatingType === "daily" ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.md }} />
        ) : (
          <AivoButton
            title={t("learnerChallenges.findMatch")}
            onPress={() => handleCreateChallenge("daily", "Quick Math Battle", "Mathematics")}
            size="sm"
            style={{ marginTop: spacing.md }}
          />
        )}
      </AivoCard>

      <AivoCard style={styles.battleCard}>
        <Ionicons name="people" size={32} color={colors.secondary} />
        <Text style={styles.battleTitle}>{t("learnerChallenges.teamChallenge")}</Text>
        <Text style={styles.battleDesc}>{t("learnerChallenges.teamChallengeDesc")}</Text>
        {creatingType === "multiplayer" ? (
          <ActivityIndicator color={colors.secondary} style={{ marginTop: spacing.md }} />
        ) : (
          <AivoButton
            title={t("learnerChallenges.joinTeam")}
            onPress={() => setJoinModalVisible(true)}
            variant="secondary"
            size="sm"
            style={{ marginTop: spacing.md }}
          />
        )}
      </AivoCard>

      <AivoCard style={styles.battleCard}>
        <Ionicons name="trophy" size={32} color={colors.primary} />
        <Text style={styles.battleTitle}>{t("learnerChallenges.weeklyTournament")}</Text>
        <Text style={styles.battleDesc}>{t("learnerChallenges.weeklyTournamentDesc")}</Text>
        {creatingType === "weekly" ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />
        ) : (
          <AivoButton
            title={t("learnerChallenges.enterTournament")}
            onPress={() => handleCreateChallenge("weekly", "Weekly Tournament", "Mathematics")}
            variant="outline"
            size="sm"
            style={{ marginTop: spacing.md }}
          />
        )}
      </AivoCard>

      <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>
        {t("learnerChallenges.inviteFriend")}
      </Text>
      <AivoCard>
        <Text style={styles.inviteText}>{t("learnerChallenges.inviteText")}</Text>
        <AivoButton
          title="Create & Share Invite"
          onPress={() => handleCreateChallenge("multiplayer", "Friend Challenge", "Mathematics")}
          variant="outline"
          size="sm"
          style={{ marginTop: spacing.md }}
        />
      </AivoCard>

      <Modal visible={joinModalVisible} transparent animationType="slide">
        <Pressable accessibilityRole="button" style={styles.modalOverlay} onPress={() => setJoinModalVisible(false)}>
          <Pressable accessibilityRole="button" style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>Join a Challenge</Text>
            <Text style={styles.modalDesc}>Enter the invite code from your friend</Text>
            <TextInput accessibilityLabel="Text input field"
              style={styles.codeInput}
              value={joinCode}
              onChangeText={(v) =>
                setJoinCode(
                  v
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                    .slice(0, 8),
                )
              }
              placeholder="ABCD1234"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="characters"
              maxLength={8}
            />
            <View style={{ flexDirection: "row", gap: 8, marginTop: spacing.md }}>
              <AivoButton
                title={t("common.cancel")}
                onPress={() => {
                  setJoinModalVisible(false);
                  setJoinCode("");
                }}
                variant="outline"
                size="sm"
                style={{ flex: 1 }}
              />
              {joining ? (
                <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
              ) : (
                <AivoButton
                  title="Join"
                  onPress={handleJoinChallenge}
                  size="sm"
                  style={{ flex: 1 }}
                />
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  backRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md },
  backText: { fontSize: 16, fontFamily: "Nunito-SemiBold", color: colors.primary },
  title: { fontSize: 24, fontFamily: "Nunito-ExtraBold", color: colors.text },
  subtitle: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  battleCard: {
    alignItems: "center" as const,
    marginBottom: spacing.md,
    paddingVertical: spacing.lg,
  },
  battleTitle: { fontSize: 18, fontFamily: "Nunito-Bold", color: colors.text, marginTop: 8 },
  battleDesc: {
    fontSize: 13,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Nunito-Bold",
    color: colors.text,
    marginBottom: spacing.md,
  },
  inviteText: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    textAlign: "center",
  },
  codeBox: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
    marginTop: spacing.md,
  },
  codeText: {
    fontSize: 24,
    fontFamily: "Nunito-ExtraBold",
    color: colors.primary,
    letterSpacing: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    width: "85%",
    maxWidth: 480,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Nunito-ExtraBold",
    color: colors.text,
    textAlign: "center",
  },
  modalDesc: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
    marginBottom: spacing.md,
  },
  codeInput: {
    height: 52,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
    textAlign: "center",
    fontSize: 22,
    fontFamily: "Nunito-ExtraBold",
    color: colors.text,
    letterSpacing: 4,
  },
});
