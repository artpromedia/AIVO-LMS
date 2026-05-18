import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "./theme";

interface AivoHeaderProps {
  title: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
  leftAction?: React.ReactNode;
}

export function AivoHeader({ title, subtitle, rightAction, leftAction }: AivoHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={[theme.colors.primaryDark, theme.colors.primary]}
      style={[styles.container, { paddingTop: insets.top + 12 }]}
    >
      <View style={styles.row}>
        {leftAction && <View style={styles.action}>{leftAction}</View>}
        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
        {rightAction && <View style={styles.action}>{rightAction}</View>}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 16,
    paddingHorizontal: theme.spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontFamily: theme.fonts.heading,
    color: "#FFFFFF",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: theme.fonts.body,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  action: {
    marginHorizontal: 8,
  },
});
