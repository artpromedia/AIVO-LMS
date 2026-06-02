import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications, useMarkNotificationRead } from "@/hooks/useNotifications";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { ScreenHeader } from "@/src/components/layout/ScreenHeader";
import { Card } from "@/components/ui";
import { LoadingState, EmptyState } from "@aivo/mobile-ui";
import { spacing } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

function fmtWhen(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Learner notifications (MOB-LRN-012) — mirror of web's
 * /learner/notifications. Polls comms-svc; tapping marks read.
 */
export default function LearnerNotificationsScreen() {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const { user } = useAuth();
  const { data: items, isLoading } = useNotifications(user?.id ?? "");
  const markRead = useMarkNotificationRead();

  return (
    <ResponsiveScreen maxWidth="reading" background={palette.bgPage}>
      <ScreenHeader title={t("notifications.title", "Notifications")} />
      {isLoading ? (
        <LoadingState />
      ) : !items || items.length === 0 ? (
        <EmptyState
          icon={<Ionicons name="notifications-outline" size={48} color={palette.inkMuted} />}
          title={t("notifications.emptyTitle", "You're all caught up")}
          message={t("notifications.emptyBody", "New updates will appear here.")}
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {items.map((n) => (
            <Pressable
              key={n.id}
              accessibilityRole="button"
              accessibilityLabel={n.title}
              onPress={() => !n.readAt && markRead.mutate({ userId: user?.id ?? "", id: n.id })}
            >
              <Card
                tone="raised"
                style={[
                  styles.row,
                  !n.readAt && { borderLeftWidth: 3, borderLeftColor: palette.primary },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemTitle, { color: palette.ink }]}>{n.title}</Text>
                  {n.body ? (
                    <Text style={[styles.body, { color: palette.inkMuted }]}>{n.body}</Text>
                  ) : null}
                </View>
                <Text style={[styles.when, { color: palette.inkMuted }]}>
                  {fmtWhen(n.createdAt)}
                </Text>
              </Card>
            </Pressable>
          ))}
        </View>
      )}
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  itemTitle: { fontSize: 15, fontFamily: fontFamilies.bodyBold },
  body: { fontSize: 13, fontFamily: fontFamilies.bodyRegular, marginTop: 2, lineHeight: 18 },
  when: { fontSize: 12, fontFamily: fontFamilies.bodyRegular },
});
