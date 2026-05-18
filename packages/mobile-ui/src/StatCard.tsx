import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { theme } from "./theme";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: string;
  subtitle?: string;
}

export function StatCard({
  label,
  value,
  icon,
  color = theme.colors.primary,
  subtitle,
}: StatCardProps) {
  return (
    <View style={styles.card}>
      {icon && (
        <View style={[styles.iconContainer, { backgroundColor: color + "15" }]}>{icon}</View>
      )}
      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.md,
    alignItems: "center",
    flex: 1,
    ...theme.shadows.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  value: {
    fontSize: 24,
    fontFamily: theme.fonts.heading,
  },
  label: {
    fontSize: 12,
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    marginTop: 4,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 11,
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
});
