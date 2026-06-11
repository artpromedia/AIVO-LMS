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

export default function TherapistDashboard() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { data: clients, isLoading, refetch } = useConnectedLearners();
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
            name={user?.name || t("therapist.title")}
            subtitle={t("therapist.caseload")}
            onPress={() => router.push("/(therapist)/settings" as Href)}
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
          {t("therapist.greeting", { name: user?.name })}
        </Text>

        {!clients?.length ? (
          <EmptyState
            icon={<Ionicons name="medkit-outline" size={48} color={palette.inkMuted} />}
            title={t("therapist.noClientsTitle")}
            message={t("therapist.noClientsMessage")}
          />
        ) : (
          clients.map((client: any) => (
            <Pressable accessibilityRole="button"
              key={client.id}
              onPress={() => router.push(`/(therapist)/client/${client.id}` as Href)}
              style={{ marginBottom: spacing.md }}
            >
              <Card>
                <View style={styles.clientRow}>
                  <View
                    style={[
                      styles.clientAvatar,
                      { backgroundColor: INCLUSIVE_WARM_PALETTE.primarySoft },
                    ]}
                  >
                    <Text
                      style={[
                        styles.clientInitial,
                        { color: palette.primary, fontFamily: fontFamilies.bodyBold },
                      ]}
                    >
                      {client.firstName?.[0] || "C"}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.clientName,
                        { color: palette.ink, fontFamily: fontFamilies.bodyBold },
                      ]}
                    >
                      {client.firstName} {client.lastName}
                    </Text>
                    <Text style={[styles.clientInfo, { color: palette.inkMuted }]}>
                      Grade {client.gradeLevel} | {client.functioningLevel}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={palette.inkMuted} />
                </View>
                <View style={[styles.quickActions, { borderTopColor: palette.border }]}>
                  <ActionLink
                    icon="flag-outline"
                    label={t("therapist.goals")}
                    tint={palette.primary}
                    onPress={() => router.push(`/(therapist)/client/${client.id}/goals` as Href)}
                  />
                  <ActionLink
                    icon="create-outline"
                    label={t("therapist.notes")}
                    tint={INCLUSIVE_WARM_PALETTE.info}
                    onPress={() => router.push(`/(therapist)/client/${client.id}/notes` as Href)}
                  />
                  <ActionLink
                    icon="document-text-outline"
                    label={t("therapist.reports")}
                    tint={INCLUSIVE_WARM_PALETTE.success}
                    onPress={() => router.push(`/(therapist)/client/${client.id}/reports` as Href)}
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

function ActionLink({
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
    <Pressable style={styles.actionBtn} onPress={onPress} accessibilityRole="button">
      <Ionicons name={icon} size={16} color={tint} />
      <Text
        style={[
          styles.actionText,
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
  clientRow: { flexDirection: "row", alignItems: "center" },
  clientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  clientInitial: { fontSize: 18 },
  clientName: { fontSize: 16 },
  clientInfo: { fontSize: 13, fontFamily: "Nunito-Regular" },
  quickActions: {
    flexDirection: "row",
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    justifyContent: "space-around",
  },
  actionBtn: { alignItems: "center", gap: 4 },
  actionText: { fontSize: 11 },
});
