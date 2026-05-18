import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { theme } from "./theme";

interface AivoCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: keyof typeof theme.spacing;
}

export function AivoCard({ children, style, padding = "md" }: AivoCardProps) {
  return <View style={[styles.card, { padding: theme.spacing[padding] }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xxl,
    ...theme.shadows.md,
  },
});
