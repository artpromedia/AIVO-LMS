import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from "react-native";
import { router, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { useConnectedLearners } from "@/hooks/useFamily";
import { StatCard, EmptyState, LoadingState } from "@aivo/mobile-ui";
import { INCLUSIVE_WARM_PALETTE } from "@aivo/brand";
import { spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { Card, SensoryToggle, HeaderUserChip } from "@/components/ui";
import { useWindowSizeClass } from "@/src/design/useWindowSizeClass";
import { CONTENT_MAX_WIDTH, pickBySizeClass } from "@/src/design/responsive";
import { useResponsiveType } from "@/src/design/useResponsiveType";

export default function TeacherDashboard() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { data: students, isLoading, refetch } = useConnectedLearners();
  const palette = useSensoryPalette();
  const { sizeClass, width: winWidth, isTablet } = useWindowSizeClass();
  const type = useResponsiveType();

  if (isLoading) return <LoadingState />;

  const hPad = pickBySizeClass(sizeClass, {
    compact: spacing.md,
    medium: spacing.lg,
    expanded: spacing.xl,
  });
  const maxContentWidth = isTablet ? CONTENT_MAX_WIDTH.dashboard : winWidth;
  const contentWidth = Math.min(winWidth - hPad * 2, maxContentWidth);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bgPage }}
      contentContainerStyle={{
        paddingTop: isTablet ? spacing.lg : insets.top + 16,
        paddingBottom: 32,
        paddingHorizontal: hPad,
        alignItems: "center",
      }}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={refetch} colors={[palette.primary]} />
      }
    >
      <View style={{ width: contentWidth }}>
        <View style={styles.header}>
          <HeaderUserChip
            name={user?.name || t("teacher.title")}
            subtitle={t("teacher.classroomOverview")}
            onPress={() => router.push("/(teacher)/settings" as Href)}
          />
          <View style={styles.headerActions}>
            <SensoryToggle variant="icon" />
            <Pressable onPress={logout} accessibilityLabel="Log out" hitSlop={12}>
              <Ionicons name="log-out-outline" size={22} color={palette.inkMuted} />
            </Pressable>
          </View>
        </View>

        <Text
          style={[
            styles.greeting,
            {
              color: palette.ink,
              fontFamily: fontFamilies.displayBold,
              fontSize: type.h1.fontSize,
              lineHeight: type.h1.lineHeight,
            },
          ]}
        >
          {t("teacher.greeting", { name: user?.name })}
        </Text>

        <View style={styles.statsRow}>
          <StatCard
            label={t("teacher.students")}
            value={students?.length || 0}
            icon={<Ionicons name="people" size={20} color={palette.primary} />}
          />
          <View style={{ width: 8 }} />
          <StatCard
            label={t("teacher.atRisk")}
            value={2}
            icon={<Ionicons name="warning" size={20} color={INCLUSIVE_WARM_PALETTE.danger} />}
            color={INCLUSIVE_WARM_PALETTE.danger}
          />
          <View style={{ width: 8 }} />
          <StatCard
            label={t("teacher.avgProgress")}
            value="72%"
            icon={<Ionicons name="trending-up" size={20} color={INCLUSIVE_WARM_PALETTE.success} />}
            color={INCLUSIVE_WARM_PALETTE.success}
          />
        </View>

        <View style={styles.sectionRow}>
          <Pressable
            onPress={() => router.push("/(teacher)/learners" as Href)}
            accessibilityRole="button"
            accessibilityLabel={t("teacher.students")}
          >
            <Text
              style={[
                styles.sectionTitle,
                { color: palette.ink, fontFamily: fontFamilies.bodyBold },
              ]}
            >
              {t("teacher.students")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/(teacher)/insights" as Href)}
            accessibilityRole="button"
            accessibilityLabel={t("teacherInsights.title", "Class insights")}
            hitSlop={8}
          >
            <Text style={[styles.sectionLink, { color: palette.primary }]}>
              {t("teacherInsights.title", "Class insights")}
            </Text>
          </Pressable>
        </View>
        {!students?.length ? (
          <EmptyState
            icon={<Ionicons name="people-outline" size={48} color={palette.inkMuted} />}
            title={t("teacher.noStudentsTitle")}
            message={t("teacher.noStudentsMessage")}
          />
        ) : (
          students.map((student: any) => (
            <Pressable accessibilityRole="button"
              key={student.id}
              onPress={() => router.push(`/(teacher)/student/${student.id}` as Href)}
              style={{ marginBottom: spacing.sm }}
            >
              <Card>
                <View style={styles.studentRow}>
                  <View
                    style={[
                      styles.studentAvatar,
                      { backgroundColor: INCLUSIVE_WARM_PALETTE.primarySoft },
                    ]}
                  >
                    <Text
                      style={[
                        styles.studentInitial,
                        { color: palette.primary, fontFamily: fontFamilies.bodyBold },
                      ]}
                    >
                      {student.firstName?.[0] || "S"}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.studentName,
                        { color: palette.ink, fontFamily: fontFamilies.bodyBold },
                      ]}
                    >
                      {student.firstName} {student.lastName}
                    </Text>
                    <Text style={[styles.studentGrade, { color: palette.inkMuted }]}>
                      Grade {student.gradeLevel}
                    </Text>
                  </View>
                  <View style={[styles.levelBadge, { backgroundColor: palette.accentSoft }]}>
                    <Text
                      style={[
                        styles.levelText,
                        { color: palette.primary, fontFamily: fontFamilies.bodySemiBold },
                      ]}
                    >
                      {student.functioningLevel}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={palette.inkMuted} />
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  greeting: { fontSize: 28, marginBottom: spacing.md, letterSpacing: -0.5 },
  statsRow: { flexDirection: "row", marginBottom: spacing.lg },
  sectionTitle: { fontSize: 18, marginBottom: spacing.md },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionLink: { fontSize: 13, fontFamily: fontFamilies.bodyBold, marginBottom: spacing.md },
  studentRow: { flexDirection: "row", alignItems: "center" },
  studentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  studentInitial: { fontSize: 16 },
  studentName: { fontSize: 15 },
  studentGrade: { fontSize: 12, fontFamily: "Nunito-Regular" },
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    marginRight: 8,
  },
  levelText: { fontSize: 11 },
});
