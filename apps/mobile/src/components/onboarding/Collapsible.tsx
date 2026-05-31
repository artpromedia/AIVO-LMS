import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import { spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

/**
 * Collapsible legal/disclosure row — the mobile analogue of web's
 * `LegalCollapse`. Progressive disclosure so dense legal copy is one
 * tap away rather than the default reading experience.
 */
export interface CollapsibleProps {
  summary: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function Collapsible({ summary, defaultOpen = false, children }: CollapsibleProps) {
  const palette = useSensoryPalette();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={[styles.wrap, { borderColor: palette.border, backgroundColor: palette.bgRaised }]}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={summary}
        style={styles.summaryRow}
      >
        <Text style={[styles.summary, { color: palette.ink }]}>{summary}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={palette.inkMuted} />
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 1, borderRadius: radius.lg, overflow: "hidden" },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    gap: spacing.sm,
  },
  summary: { flex: 1, fontSize: 14, fontFamily: fontFamilies.bodyBold },
  body: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: 6 },
});
