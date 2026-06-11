/**
 * Full-screen failure surface for an unusable build configuration
 * (no API origin baked in). Operator-facing: shown instead of an app
 * where every request would silently fail. Plain RN primitives only —
 * this renders before providers/fonts are guaranteed.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import i18n from "@/lib/i18n";

export function ConfigErrorScreen({ detail }: { detail: string }) {
  return (
    <View style={styles.container} accessibilityRole="alert">
      <Text style={styles.heading} accessibilityRole="header">
        {i18n.t("configError.title")}
      </Text>
      <Text style={styles.body}>{i18n.t("configError.body")}</Text>
      <Text style={styles.detail}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    padding: 24,
  },
  heading: { fontSize: 22, fontWeight: "700", textAlign: "center", color: "#1f2937" },
  body: { fontSize: 15, textAlign: "center", color: "#4b5563", marginTop: 12, maxWidth: 340 },
  detail: { fontSize: 12, textAlign: "center", color: "#9ca3af", marginTop: 16, maxWidth: 340 },
});
