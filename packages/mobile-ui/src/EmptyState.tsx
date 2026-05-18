import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { theme } from "./theme";
import { AivoButton } from "./AivoButton";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction && (
        <AivoButton title={actionLabel} onPress={onAction} size="sm" style={{ marginTop: 16 }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.xl,
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text,
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
});
