import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { useConnectedLearners } from "@/hooks/useFamily";
import { AivoCard, EmptyState, LoadingState } from "@aivo/mobile-ui";
import { colors, spacing } from "@/constants/colors";

export default function CaregiverDashboard() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { data: children, isLoading, refetch } = useConnectedLearners();

  if (isLoading) return <LoadingState />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32 }}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={refetch} colors={[colors.primary]} />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{t("caregiver.greeting", { name: user?.name })}</Text>
          <Text style={styles.subGreeting}>{t("caregiver.assignedChildren")}</Text>
        </View>
        <Pressable onPress={logout}>
          <Ionicons name="log-out-outline" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      {!children?.length ? (
        <EmptyState
          icon={<Ionicons name="people-outline" size={48} color={colors.textSecondary} />}
          title={t("caregiver.noChildrenTitle")}
          message={t("caregiver.noChildrenMessage")}
        />
      ) : (
        children.map((child: any) => (
          <Pressable
            key={child.id}
            onPress={() => router.push(`/(caregiver)/child/${child.id}` as any)}
          >
            <AivoCard style={styles.childCard}>
              <View style={styles.childRow}>
                <View style={styles.childAvatar}>
                  <Text style={styles.childInitial}>{child.firstName?.[0] || "C"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.childName}>
                    {child.firstName} {child.lastName}
                  </Text>
                  <Text style={styles.childGrade}>Grade {child.gradeLevel}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </View>
              <View style={styles.quickLinks}>
                <Pressable
                  style={styles.linkBtn}
                  onPress={() => router.push(`/(caregiver)/child/${child.id}/brain` as any)}
                >
                  <Ionicons name="bulb-outline" size={16} color={colors.primary} />
                  <Text style={styles.linkText}>{t("caregiver.brain")}</Text>
                </Pressable>
                <Pressable
                  style={styles.linkBtn}
                  onPress={() => router.push(`/(caregiver)/child/${child.id}/iep-goals` as any)}
                >
                  <Ionicons name="flag-outline" size={16} color={colors.info} />
                  <Text style={styles.linkText}>{t("caregiver.iep")}</Text>
                </Pressable>
                <Pressable
                  style={styles.linkBtn}
                  onPress={() => router.push(`/(caregiver)/child/${child.id}/sessions` as any)}
                >
                  <Ionicons name="time-outline" size={16} color={colors.secondary} />
                  <Text style={styles.linkText}>{t("caregiver.sessions")}</Text>
                </Pressable>
                <Pressable
                  style={styles.linkBtn}
                  onPress={() => router.push(`/(caregiver)/child/${child.id}/observation` as any)}
                >
                  <Ionicons name="create-outline" size={16} color={colors.accent} />
                  <Text style={styles.linkText}>{t("caregiver.note")}</Text>
                </Pressable>
              </View>
            </AivoCard>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  greeting: { fontSize: 24, fontFamily: "Nunito-ExtraBold", color: colors.text },
  subGreeting: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginTop: 2,
  },
  childCard: { marginBottom: spacing.md },
  childRow: { flexDirection: "row", alignItems: "center" },
  childAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight + "30",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  childInitial: { fontSize: 18, fontFamily: "Nunito-Bold", color: colors.primary },
  childName: { fontSize: 16, fontFamily: "Nunito-Bold", color: colors.text },
  childGrade: { fontSize: 13, fontFamily: "Nunito-Regular", color: colors.textSecondary },
  quickLinks: {
    flexDirection: "row",
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    justifyContent: "space-around",
  },
  linkBtn: { alignItems: "center", gap: 4 },
  linkText: { fontSize: 11, fontFamily: "Nunito-SemiBold", color: colors.textSecondary },
});
