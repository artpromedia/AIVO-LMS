import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { useConnectedLearners } from "@/hooks/useFamily";
import { AivoCard, StatCard, EmptyState, LoadingState } from "@aivo/mobile-ui";
import { colors, spacing, radius } from "@/constants/colors";

export default function TeacherDashboard() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { data: students, isLoading, refetch } = useConnectedLearners();

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
          <Text style={styles.greeting}>{t("teacher.greeting", { name: user?.name })}</Text>
          <Text style={styles.subGreeting}>{t("teacher.classroomOverview")}</Text>
        </View>
        <Pressable onPress={logout}>
          <Ionicons name="log-out-outline" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <StatCard
          label={t("teacher.students")}
          value={students?.length || 0}
          icon={<Ionicons name="people" size={20} color={colors.primary} />}
        />
        <View style={{ width: 8 }} />
        <StatCard
          label={t("teacher.atRisk")}
          value={2}
          icon={<Ionicons name="warning" size={20} color={colors.error} />}
          color={colors.error}
        />
        <View style={{ width: 8 }} />
        <StatCard
          label={t("teacher.avgProgress")}
          value="72%"
          icon={<Ionicons name="trending-up" size={20} color={colors.success} />}
          color={colors.success}
        />
      </View>

      <Text style={styles.sectionTitle}>{t("teacher.students")}</Text>
      {!students?.length ? (
        <EmptyState
          icon={<Ionicons name="people-outline" size={48} color={colors.textSecondary} />}
          title={t("teacher.noStudentsTitle")}
          message={t("teacher.noStudentsMessage")}
        />
      ) : (
        students.map((student: any) => (
          <Pressable
            key={student.id}
            onPress={() => router.push(`/(teacher)/student/${student.id}` as any)}
          >
            <AivoCard style={styles.studentCard}>
              <View style={styles.studentRow}>
                <View style={styles.studentAvatar}>
                  <Text style={styles.studentInitial}>{student.firstName?.[0] || "S"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.studentName}>
                    {student.firstName} {student.lastName}
                  </Text>
                  <Text style={styles.studentGrade}>Grade {student.gradeLevel}</Text>
                </View>
                <View style={[styles.levelBadge, { backgroundColor: colors.primary + "15" }]}>
                  <Text style={[styles.levelText, { color: colors.primary }]}>
                    {student.functioningLevel}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
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
  statsRow: { flexDirection: "row", marginBottom: spacing.lg },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Nunito-Bold",
    color: colors.text,
    marginBottom: spacing.md,
  },
  studentCard: { marginBottom: spacing.sm },
  studentRow: { flexDirection: "row", alignItems: "center" },
  studentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight + "30",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  studentInitial: { fontSize: 16, fontFamily: "Nunito-Bold", color: colors.primary },
  studentName: { fontSize: 15, fontFamily: "Nunito-Bold", color: colors.text },
  studentGrade: { fontSize: 12, fontFamily: "Nunito-Regular", color: colors.textSecondary },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    marginRight: 8,
  },
  levelText: { fontSize: 11, fontFamily: "Nunito-SemiBold" },
});
