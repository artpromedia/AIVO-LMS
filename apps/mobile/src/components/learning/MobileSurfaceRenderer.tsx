/**
 * Surface renderer placeholder. Sprint 03–05 fills in geometry_workspace,
 * scratchpad, number_line, etc. For Sprint 02 it renders a clear "surface
 * not yet supported on mobile" state and exposes a submit handler so the
 * runtime can advance.
 */

import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import type { TierThemeMobile } from "@aivo/mobile-ui";
import type { SurfaceBeat } from "@/src/types/stage";

interface Props {
  theme: TierThemeMobile;
  beat: SurfaceBeat;
  disabled?: boolean;
  onSubmit: (commands: unknown) => void;
}

export function MobileSurfaceRenderer({ theme, beat, disabled, onSubmit }: Props) {
  const styles = createStyles(theme);
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>
        {beat.surface.kind.replace(/_/g, " ")}
      </Text>
      {beat.text ? <Text style={styles.body}>{beat.text}</Text> : null}
      <Text style={styles.note}>
        This surface will be interactive in the next mobile release.
      </Text>
      <Pressable
        onPress={() => onSubmit({})}
        disabled={disabled}
        style={[styles.submit, disabled && styles.submitDisabled]}
      >
        <Text style={styles.submitText}>I'm done</Text>
      </Pressable>
    </View>
  );
}

function createStyles(theme: TierThemeMobile) {
  return StyleSheet.create({
    wrap: { padding: 16, gap: 12 },
    title: { color: theme.colors.text, fontSize: 18, fontWeight: "700", textTransform: "capitalize" },
    body: { color: theme.colors.text, fontSize: 18 },
    note: { color: theme.colors.text, opacity: 0.7, fontStyle: "italic" },
    submit: {
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
      marginTop: 8,
    },
    submitDisabled: { opacity: 0.4 },
    submitText: { color: theme.colors.surface, fontSize: 18, fontWeight: "700" },
  });
}
