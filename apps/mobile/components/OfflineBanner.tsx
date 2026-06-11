/**
 * Offline / pending-sync banner (Sprint A7).
 *
 * lib/offline-queue + hooks/useOffline existed with no UI consumer: work
 * queued silently and neither learners nor the Maestro journey could see
 * sync state. This banner renders whenever the device is offline or
 * queued writes are pending, and disappears once the queue drains (the
 * hook announces "your work has been saved" to screen readers).
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "@/hooks/useTranslation";
import { useOffline } from "@/hooks/useOffline";
import { fontFamilies } from "@/constants/typography";

export function OfflineBanner() {
  const { t } = useTranslation();
  const { isOnline, pendingActions } = useOffline();

  if (isOnline && pendingActions === 0) return null;

  const message = !isOnline
    ? pendingActions > 0
      ? t("offline.bannerQueued", "Offline — {{count}} change(s) will sync when you're back.", {
          count: pendingActions,
        })
      : t("offline.banner", "You're offline. Keep going — progress is saved on this device.")
    : t("offline.syncing", "Syncing {{count}} change(s)…", { count: pendingActions });

  return (
    <View
      testID="offline-banner"
      accessibilityLiveRegion="polite"
      accessibilityRole="text"
      accessibilityLabel={message}
      style={[styles.banner, !isOnline ? styles.offline : styles.syncing]}
    >
      <Ionicons
        name={!isOnline ? "cloud-offline" : "sync"}
        size={16}
        color="#ffffff"
        accessibilityElementsHidden
      />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  offline: { backgroundColor: "#475569" },
  syncing: { backgroundColor: "#2563eb" },
  text: {
    color: "#ffffff",
    fontFamily: fontFamilies.bodyBold,
    fontSize: 13,
  },
});
