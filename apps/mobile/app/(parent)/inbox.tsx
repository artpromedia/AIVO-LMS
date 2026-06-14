import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Linking,
  Platform,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import type { Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import {
  useParentInbox,
  useInboxMarkRead,
  useInboxDismiss,
  type InboxNotification,
} from "@/hooks/useParentInbox";
import { AivoCard } from "@aivo/mobile-ui";
import { colors, spacing, radius } from "@/constants/colors";
import { mapInboxUrlToMobileRoute } from "@/lib/inboxLinks";

type TabKey = "all" | "action" | "celebrations" | "archived";

const TABS: TabKey[] = ["all", "action", "celebrations", "archived"];

const TYPE_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; tint: string }> = {
  brain_review: { icon: "bulb", tint: colors.primary },
  recommendation: { icon: "sparkles", tint: colors.visualSel },
  iep_reminder: { icon: "clipboard", tint: colors.visualReading },
  milestone: { icon: "trophy", tint: colors.visualSel },
  progress: { icon: "trending-up", tint: colors.visualScience },
  team: { icon: "people", tint: colors.visualReading },
  system: { icon: "information-circle", tint: colors.primary },
};

function metaFor(type: string) {
  return TYPE_META[type] ?? { icon: "notifications" as const, tint: colors.primary };
}

function filterNotifications(items: InboxNotification[], tab: TabKey) {
  if (tab === "action") {
    return items.filter(
      (n) => ["brain_review", "recommendation", "iep_reminder"].includes(n.type) && !n.readAt,
    );
  }
  if (tab === "celebrations") {
    return items.filter((n) => ["milestone", "progress"].includes(n.type));
  }
  if (tab === "archived") {
    return items.filter((n) => !!n.readAt);
  }
  return items;
}

function resolveWebOrigin(): string | null {
  const configured = (process.env.EXPO_PUBLIC_WEB_URL || "").replace(/\/+$/, "");
  if (configured) return configured;
  if (__DEV__) {
    return (
      Platform.select({
        android: "http://10.0.2.2:5000",
        default: "http://localhost:5000",
      }) ?? null
    );
  }
  return null;
}

function toWebUrl(actionUrl: string | undefined): string | null {
  if (!actionUrl) return null;
  if (/^https?:\/\//i.test(actionUrl)) return actionUrl;
  const origin = resolveWebOrigin();
  if (!origin) return null;
  return `${origin}${actionUrl.startsWith("/") ? actionUrl : `/${actionUrl}`}`;
}

export default function ParentInboxScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user } = useAuth();
  const parentId = user?.id ?? "";
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useParentInbox(parentId);
  const markRead = useInboxMarkRead(parentId);
  const dismiss = useInboxDismiss(parentId);

  const items = data?.items ?? [];
  const filtered = filterNotifications(items, activeTab);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const onView = async (n: InboxNotification) => {
    if (!n.readAt) markRead.mutate(n.id);
    const target = mapInboxUrlToMobileRoute(n.actionUrl);
    if (target) {
      router.push({ pathname: target.pathname, params: target.params } as Href);
      return;
    }
    const webUrl = toWebUrl(n.actionUrl);
    if (webUrl) {
      await Linking.openURL(webUrl);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top + 16 }]}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
      }
    >
      <Pressable
        onPress={() => router.back()}
        style={styles.backRow}
        accessibilityRole="button"
        accessibilityLabel={t("common.back")}
      >
        <Ionicons name="arrow-back" size={20} color={colors.primary} />
        <Text style={styles.backText}>{t("common.back")}</Text>
      </Pressable>

      <Text style={styles.title}>{t("parentInbox.title")}</Text>

      <View style={styles.tabRow}>
        {TABS.map((key) => {
          const isActive = activeTab === key;
          return (
            <Pressable
              key={key}
              onPress={() => setActiveTab(key)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              style={[styles.tab, isActive && styles.tabActive]}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {t(`parentInbox.tabs.${key}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="mail-open-outline" size={28} color={colors.primary} />
          </View>
          <Text style={styles.emptyText}>{t(`parentInbox.empty.${activeTab}`)}</Text>
        </View>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {filtered.map((n) => {
            const meta = metaFor(n.type);
            const unread = !n.readAt;
            return (
              <AivoCard
                key={n.id}
                style={[
                  styles.card,
                  unread && { borderLeftWidth: 4, borderLeftColor: colors.primary },
                ]}
              >
                <View style={styles.cardRow}>
                  <View style={[styles.typeIcon, { backgroundColor: meta.tint + "1F" }]}>
                    <Ionicons name={meta.icon} size={18} color={meta.tint} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.cardHeader}>
                      <Text
                        style={[styles.cardTitle, unread && styles.cardTitleUnread]}
                        numberOfLines={2}
                      >
                        {n.title}
                      </Text>
                      <Text style={styles.cardDate}>
                        {new Date(n.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                    {n.body ? (
                      <Text style={styles.cardBody} numberOfLines={3}>
                        {n.body}
                      </Text>
                    ) : null}
                    <View style={styles.actions}>
                      {n.actionUrl &&
                      (mapInboxUrlToMobileRoute(n.actionUrl) || toWebUrl(n.actionUrl)) ? (
                        <Pressable
                          onPress={() => onView(n)}
                          style={[styles.actionBtn, styles.actionPrimary]}
                          accessibilityRole="button"
                        >
                          <Text style={styles.actionPrimaryText}>{t("parentInbox.view")} →</Text>
                        </Pressable>
                      ) : null}
                      {unread ? (
                        <Pressable
                          onPress={() => markRead.mutate(n.id)}
                          style={[styles.actionBtn, styles.actionGhost]}
                          accessibilityRole="button"
                        >
                          <Text style={styles.actionGhostText}>{t("parentInbox.markRead")}</Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        onPress={() => dismiss.mutate(n.id)}
                        style={[styles.actionBtn, styles.actionGhost]}
                        accessibilityRole="button"
                      >
                        <Text style={styles.actionDismissText}>{t("parentInbox.dismiss")}</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </AivoCard>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md },
  backRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md },
  backText: { fontSize: 16, fontFamily: "Nunito-SemiBold", color: colors.primary },
  title: {
    fontSize: 24,
    fontFamily: "Nunito-ExtraBold",
    color: colors.text,
    marginBottom: spacing.md,
  },
  tabRow: { flexDirection: "row", gap: 6, marginBottom: spacing.md, flexWrap: "wrap" },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    minHeight: 36,
    justifyContent: "center",
  },
  tabActive: { backgroundColor: colors.primary + "1F" },
  tabText: { fontSize: 13, fontFamily: "Nunito-SemiBold", color: colors.textSecondary },
  tabTextActive: { color: colors.primary },
  centered: { paddingVertical: spacing.xl, alignItems: "center" },
  empty: { paddingVertical: spacing.xl, alignItems: "center", gap: 12 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.xl,
    backgroundColor: colors.primary + "1F",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Nunito-SemiBold",
    color: colors.textSecondary,
    textAlign: "center",
  },
  card: { padding: spacing.sm },
  cardRow: { flexDirection: "row", gap: 12 },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  cardTitle: { flex: 1, fontSize: 14, fontFamily: "Nunito-SemiBold", color: colors.text },
  cardTitleUnread: { fontFamily: "Nunito-Bold" },
  cardDate: { fontSize: 11, fontFamily: "Nunito-Regular", color: colors.textSecondary },
  cardBody: {
    fontSize: 13,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  actions: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    minHeight: 32,
    justifyContent: "center",
  },
  actionPrimary: { backgroundColor: colors.primary + "1F" },
  actionPrimaryText: { fontSize: 12, fontFamily: "Nunito-Bold", color: colors.primary },
  actionGhost: { backgroundColor: colors.surface },
  actionGhostText: { fontSize: 12, fontFamily: "Nunito-SemiBold", color: colors.textSecondary },
  actionDismissText: { fontSize: 12, fontFamily: "Nunito-SemiBold", color: colors.error },
});
