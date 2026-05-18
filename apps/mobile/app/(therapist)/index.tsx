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

export default function TherapistDashboard() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { data: clients, isLoading, refetch } = useConnectedLearners();

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
          <Text style={styles.greeting}>{t("therapist.greeting", { name: user?.name })}</Text>
          <Text style={styles.subGreeting}>{t("therapist.caseload")}</Text>
        </View>
        <Pressable onPress={logout}>
          <Ionicons name="log-out-outline" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      {!clients?.length ? (
        <EmptyState
          icon={<Ionicons name="medkit-outline" size={48} color={colors.textSecondary} />}
          title={t("therapist.noClientsTitle")}
          message={t("therapist.noClientsMessage")}
        />
      ) : (
        clients.map((client: any) => (
          <Pressable
            key={client.id}
            onPress={() => router.push(`/(therapist)/client/${client.id}` as any)}
          >
            <AivoCard style={styles.clientCard}>
              <View style={styles.clientRow}>
                <View style={styles.clientAvatar}>
                  <Text style={styles.clientInitial}>{client.firstName?.[0] || "C"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.clientName}>
                    {client.firstName} {client.lastName}
                  </Text>
                  <Text style={styles.clientInfo}>
                    Grade {client.gradeLevel} | {client.functioningLevel}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </View>
              <View style={styles.quickActions}>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => router.push(`/(therapist)/client/${client.id}/goals` as any)}
                >
                  <Ionicons name="flag-outline" size={16} color={colors.primary} />
                  <Text style={styles.actionText}>{t("therapist.goals")}</Text>
                </Pressable>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => router.push(`/(therapist)/client/${client.id}/notes` as any)}
                >
                  <Ionicons name="create-outline" size={16} color={colors.info} />
                  <Text style={styles.actionText}>{t("therapist.notes")}</Text>
                </Pressable>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => router.push(`/(therapist)/client/${client.id}/reports` as any)}
                >
                  <Ionicons name="document-text-outline" size={16} color={colors.success} />
                  <Text style={styles.actionText}>{t("therapist.reports")}</Text>
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
  clientCard: { marginBottom: spacing.md },
  clientRow: { flexDirection: "row", alignItems: "center" },
  clientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight + "30",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  clientInitial: { fontSize: 18, fontFamily: "Nunito-Bold", color: colors.primary },
  clientName: { fontSize: 16, fontFamily: "Nunito-Bold", color: colors.text },
  clientInfo: { fontSize: 13, fontFamily: "Nunito-Regular", color: colors.textSecondary },
  quickActions: {
    flexDirection: "row",
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    justifyContent: "space-around",
  },
  actionBtn: { alignItems: "center", gap: 4 },
  actionText: { fontSize: 11, fontFamily: "Nunito-SemiBold", color: colors.textSecondary },
});
