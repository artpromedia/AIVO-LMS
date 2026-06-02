import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, RefreshControl } from "react-native";
import { router, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { useConnectedLearners } from "@/hooks/useFamily";
import { EmptyState, LoadingState } from "@aivo/mobile-ui";
import { INCLUSIVE_WARM_PALETTE } from "@aivo/brand";
import { spacing } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { Card, SensoryToggle, HeaderUserChip } from "@/components/ui";
import { useWindowSizeClass } from "@/src/design/useWindowSizeClass";
import { CONTENT_MAX_WIDTH, pickBySizeClass } from "@/src/design/responsive";
import { useResponsiveType } from "@/src/design/useResponsiveType";

export default function CaregiverDashboard() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { data: children, isLoading, refetch } = useConnectedLearners();
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
            name={user?.name || t("caregiver.title")}
            subtitle={t("caregiver.assignedChildren")}
            onPress={() => router.push("/(caregiver)/settings" as Href)}
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
          {t("caregiver.greeting", { name: user?.name })}
        </Text>

        {!children?.length ? (
          <EmptyState
            icon={<Ionicons name="people-outline" size={48} color={palette.inkMuted} />}
            title={t("caregiver.noChildrenTitle")}
            message={t("caregiver.noChildrenMessage")}
          />
        ) : (
          children.map((child: any) => (
            <Pressable
              key={child.id}
              onPress={() => router.push(`/(caregiver)/child/${child.id}` as Href)}
              style={{ marginBottom: spacing.md }}
            >
              <Card>
                <View style={styles.childRow}>
                  <View
                    style={[
                      styles.childAvatar,
                      { backgroundColor: INCLUSIVE_WARM_PALETTE.primarySoft },
                    ]}
                  >
                    <Text
                      style={[
                        styles.childInitial,
                        { color: palette.primary, fontFamily: fontFamilies.bodyBold },
                      ]}
                    >
                      {child.firstName?.[0] || "C"}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.childName,
                        { color: palette.ink, fontFamily: fontFamilies.bodyBold },
                      ]}
                    >
                      {child.firstName} {child.lastName}
                    </Text>
                    <Text style={[styles.childGrade, { color: palette.inkMuted }]}>
                      Grade {child.gradeLevel}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={palette.inkMuted} />
                </View>
                <View style={[styles.quickLinks, { borderTopColor: palette.border }]}>
                  <QuickLink
                    icon="bulb-outline"
                    label={t("caregiver.brain")}
                    tint={palette.primary}
                    onPress={() => router.push(`/(caregiver)/child/${child.id}/brain` as Href)}
                  />
                  <QuickLink
                    icon="flag-outline"
                    label={t("caregiver.iep")}
                    tint={INCLUSIVE_WARM_PALETTE.info}
                    onPress={() => router.push(`/(caregiver)/child/${child.id}/iep-goals` as Href)}
                  />
                  <QuickLink
                    icon="time-outline"
                    label={t("caregiver.sessions")}
                    tint={palette.warm}
                    onPress={() => router.push(`/(caregiver)/child/${child.id}/sessions` as Href)}
                  />
                  <QuickLink
                    icon="create-outline"
                    label={t("caregiver.note")}
                    tint={palette.accent}
                    onPress={() =>
                      router.push(`/(caregiver)/child/${child.id}/observation` as Href)
                    }
                  />
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function QuickLink({
  icon,
  label,
  tint,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  tint: string;
  onPress: () => void;
}) {
  const palette = useSensoryPalette();
  return (
    <Pressable style={styles.linkBtn} onPress={onPress} accessibilityRole="button">
      <Ionicons name={icon} size={16} color={tint} />
      <Text
        style={[
          styles.linkText,
          { color: palette.inkMuted, fontFamily: fontFamilies.bodySemiBold },
        ]}
      >
        {label}
      </Text>
    </Pressable>
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
  childRow: { flexDirection: "row", alignItems: "center" },
  childAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  childInitial: { fontSize: 18 },
  childName: { fontSize: 16 },
  childGrade: { fontSize: 13, fontFamily: "Nunito-Regular" },
  quickLinks: {
    flexDirection: "row",
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    justifyContent: "space-around",
  },
  linkBtn: { alignItems: "center", gap: 4 },
  linkText: { fontSize: 11 },
});
