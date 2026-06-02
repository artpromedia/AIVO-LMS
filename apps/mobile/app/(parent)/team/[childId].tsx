import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useResponsiveType } from "@/src/design/useResponsiveType";
import {
  useCollaboration,
  useInviteMember,
  type InviteRole,
  type TeamMemberRow,
} from "@/hooks/useFamily";
import { AivoCard, AivoButton, LoadingState, EmptyState } from "@aivo/mobile-ui";
import { colors, spacing, radius } from "@/constants/colors";

export default function TeamScreen() {
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const insets = useSafeAreaInsets();
  const { data: team, isLoading } = useCollaboration(childId);
  const invite = useInviteMember();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("TEACHER");
  const [specialty, setSpecialty] = useState("");
  const [credentials, setCredentials] = useState("");
  const [relationship, setRelationship] = useState("");
  const { t } = useTranslation();
  const type = useResponsiveType();

  const handleInvite = async () => {
    const email = inviteEmail.trim();
    if (!email) {
      Alert.alert(t("common.error"), t("parentTeam.emailRequired"));
      return;
    }
    try {
      await invite.mutateAsync({
        learnerId: childId,
        email,
        role: inviteRole,
        specialty: inviteRole === "THERAPIST" ? specialty.trim() || undefined : undefined,
        credentials: inviteRole === "THERAPIST" ? credentials.trim() || undefined : undefined,
        relationship: inviteRole === "CAREGIVER" ? relationship.trim() || undefined : undefined,
      });
      setInviteEmail("");
      setSpecialty("");
      setCredentials("");
      setRelationship("");
      Alert.alert(t("common.success"), t("parentTeam.inviteSent"));
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.message || t("parentTeam.inviteFailed"));
    }
  };

  const roles: {
    key: InviteRole;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    max: number;
  }[] = [
    { key: "TEACHER", label: t("parentTeam.teachers"), icon: "school", max: 1 },
    { key: "CAREGIVER", label: t("parentTeam.caregivers"), icon: "heart", max: 2 },
    { key: "THERAPIST", label: t("parentTeam.therapists"), icon: "medkit", max: 1 },
  ];

  const allMembers = useMemo<TeamMemberRow[]>(() => {
    if (!team) return [];
    const teachers = (team.teachers || []).map((m: any) => ({
      id: m.id,
      email: m.teacherEmail,
      status: m.status,
      memberType: "teacher" as const,
    }));
    const caregivers = (team.caregivers || []).map((m: any) => ({
      id: m.id,
      email: m.caregiverEmail,
      status: m.status,
      memberType: "caregiver" as const,
      relationship: m.relationship,
    }));
    const therapists = (team.therapists || []).map((m: any) => ({
      id: m.id,
      email: m.therapistEmail,
      status: m.status,
      memberType: "therapist" as const,
      specialty: m.specialty,
      credentials: m.credentials,
    }));
    return [...teachers, ...caregivers, ...therapists];
  }, [team]);

  if (isLoading) return <LoadingState />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable onPress={() => router.back()} style={styles.backRow}>
        <Ionicons name="arrow-back" size={20} color={colors.primary} />
        <Text style={styles.backText}>{t("common.back")}</Text>
      </Pressable>

      <Text style={[styles.title, { fontSize: type.h1.fontSize, lineHeight: type.h1.lineHeight }]}>
        {t("parentTeam.title")}
      </Text>
      <Text style={styles.subtitle}>{t("parentTeam.subtitle", { name: "" })}</Text>

      <View style={styles.seatCards}>
        {roles.map((r) => {
          const seatKey = r.key.toLowerCase() as "teacher" | "caregiver" | "therapist";
          const seatData = team?.seats?.[seatKey];
          const used = seatData?.used ?? 0;
          const max = seatData?.max ?? r.max;
          return (
            <AivoCard key={r.key} style={styles.seatCard}>
              <Ionicons name={r.icon} size={24} color={colors.primary} />
              <Text style={styles.seatRole}>{r.label}</Text>
              <Text style={styles.seatCount}>
                {used}/{max}
              </Text>
              <Text style={styles.seatLabel}>{t("parentTeam.seatsUsed")}</Text>
            </AivoCard>
          );
        })}
      </View>

      <Text style={[styles.sectionTitle, { marginBottom: spacing.md }]}>
        {t("parentTeam.membersHeader")}
      </Text>
      {allMembers.length ? (
        allMembers.map((m) => (
          <AivoCard key={`${m.memberType}-${m.id}`} style={styles.memberCard}>
            <View style={styles.memberRow}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberInitial}>{(m.email[0] || "?").toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{m.email}</Text>
                <Text style={styles.memberEmail}>
                  {t(`parentTeam.${m.memberType}` as any)}
                  {m.specialty ? ` · ${m.specialty}` : ""}
                  {m.credentials ? ` · ${m.credentials}` : ""}
                  {m.relationship ? ` · ${m.relationship}` : ""}
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      (m.status === "ACCEPTED" ? colors.success : colors.accent) + "20",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: m.status === "ACCEPTED" ? colors.success : colors.accent },
                  ]}
                >
                  {m.status}
                </Text>
              </View>
            </View>
          </AivoCard>
        ))
      ) : (
        <EmptyState
          icon={<Ionicons name="people-outline" size={40} color={colors.textSecondary} />}
          title={t("parentTeam.noTeamMembers")}
          message={t("parentTeam.noTeamMessage")}
        />
      )}

      <Text style={[styles.sectionTitle, { marginTop: spacing.lg, marginBottom: spacing.md }]}>
        {t("parentTeam.addMember")}
      </Text>
      <AivoCard>
        <View style={styles.roleSelector}>
          {roles.map((r) => (
            <Pressable
              key={r.key}
              style={[styles.roleBtn, inviteRole === r.key && styles.roleBtnActive]}
              onPress={() => setInviteRole(r.key)}
            >
              <Text style={[styles.roleBtnText, inviteRole === r.key && styles.roleBtnTextActive]}>
                {r.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={styles.input}
          value={inviteEmail}
          onChangeText={setInviteEmail}
          placeholder={t("parentTeam.emailPlaceholder")}
          placeholderTextColor={colors.textSecondary}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        {inviteRole === "THERAPIST" && (
          <>
            <Text style={styles.fieldLabel}>{t("parentTeam.specialty")}</Text>
            <TextInput
              style={styles.input}
              value={specialty}
              onChangeText={setSpecialty}
              placeholder={t("parentTeam.specialtyPlaceholder")}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="words"
            />
            <Text style={styles.fieldLabel}>{t("parentTeam.credentials")}</Text>
            <TextInput
              style={styles.input}
              value={credentials}
              onChangeText={setCredentials}
              placeholder={t("parentTeam.credentialsPlaceholder")}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="characters"
            />
          </>
        )}

        {inviteRole === "CAREGIVER" && (
          <>
            <Text style={styles.fieldLabel}>{t("parentTeam.relationship")}</Text>
            <TextInput
              style={styles.input}
              value={relationship}
              onChangeText={setRelationship}
              placeholder={t("parentTeam.relationshipPlaceholder")}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="words"
            />
          </>
        )}

        <AivoButton
          title={t("parentTeam.sendInvite")}
          onPress={handleInvite}
          loading={invite.isPending}
          style={{ marginTop: spacing.md }}
        />
      </AivoCard>
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
  seatCards: { flexDirection: "row", gap: 8, marginBottom: spacing.lg },
  seatCard: { flex: 1, alignItems: "center" as const, paddingVertical: spacing.md },
  seatRole: { fontSize: 13, fontFamily: "Nunito-Bold", color: colors.text, marginTop: 8 },
  seatCount: { fontSize: 22, fontFamily: "Nunito-ExtraBold", color: colors.primary, marginTop: 4 },
  seatLabel: { fontSize: 11, fontFamily: "Nunito-Regular", color: colors.textSecondary },
  sectionTitle: { fontSize: 18, fontFamily: "Nunito-Bold", color: colors.text },
  memberCard: { marginBottom: spacing.sm },
  memberRow: { flexDirection: "row", alignItems: "center" },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight + "30",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  memberInitial: { fontSize: 16, fontFamily: "Nunito-Bold", color: colors.primary },
  memberName: { fontSize: 14, fontFamily: "Nunito-Bold", color: colors.text },
  memberEmail: {
    fontSize: 12,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full },
  statusText: { fontSize: 11, fontFamily: "Nunito-SemiBold" },
  roleSelector: { flexDirection: "row", gap: 8, marginBottom: spacing.md },
  roleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  roleBtnActive: { backgroundColor: colors.primary },
  roleBtnText: { fontSize: 13, fontFamily: "Nunito-SemiBold", color: colors.textSecondary },
  roleBtnTextActive: { color: "#FFF" },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    fontFamily: "Nunito-Regular",
    color: colors.text,
    backgroundColor: colors.surface,
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Nunito-SemiBold",
    color: colors.textSecondary,
    marginTop: 12,
    marginBottom: 6,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
});
