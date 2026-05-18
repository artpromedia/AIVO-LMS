import React from "react";
import { View, Text, Pressable, StyleSheet, Image } from "react-native";
import { theme } from "./theme";

interface TutorCardProps {
  name: string;
  domain: string;
  icon: string;
  color: string;
  subscribed?: boolean;
  onPress: () => void;
}

export function TutorCard({
  name,
  domain,
  icon,
  color,
  subscribed = false,
  onPress,
}: TutorCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { borderLeftColor: color, borderLeftWidth: 4, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <View style={[styles.iconBg, { backgroundColor: color + "20" }]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.domain}>{domain}</Text>
      </View>
      {subscribed && (
        <View style={[styles.badge, { backgroundColor: theme.colors.success + "20" }]}>
          <Text style={[styles.badgeText, { color: theme.colors.success }]}>Active</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  iconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    fontSize: 24,
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 16,
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.text,
  },
  domain: {
    fontSize: 13,
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: theme.fonts.bodyBold,
  },
});
