/**
 * Math-expression beat input. Sprint 02 ships the minimal contract — a
 * plain text field with submit. Sprint 05 upgrades this with the
 * recognizer/scratchpad pipeline.
 */

import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import type { TierThemeMobile } from "@aivo/mobile-ui";

interface Props {
  theme: TierThemeMobile;
  prompt: string;
  disabled?: boolean;
  onSubmit: (expression: string) => void;
}

export function MobileMathExpressionInput({ theme, prompt, disabled, onSubmit }: Props) {
  const [value, setValue] = useState("");
  const styles = createStyles(theme);
  return (
    <View style={styles.wrap}>
      <Text style={styles.prompt}>{prompt}</Text>
      <TextInput
        value={value}
        onChangeText={setValue}
        editable={!disabled}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="Type your answer…"
        placeholderTextColor={theme.colors.text + "99"}
        style={styles.input}
        accessibilityLabel="Math expression input"
      />
      <Pressable accessibilityRole="button"
        onPress={() => value.trim() && onSubmit(value.trim())}
        disabled={disabled || !value.trim()}
        style={[styles.submit, (!value.trim() || disabled) && styles.submitDisabled]}
      >
        <Text style={styles.submitText}>Submit</Text>
      </Pressable>
    </View>
  );
}

function createStyles(theme: TierThemeMobile) {
  return StyleSheet.create({
    wrap: { padding: 16, gap: 12 },
    prompt: { color: theme.colors.text, fontSize: 22, fontWeight: "600" },
    input: {
      borderWidth: 2,
      borderColor: theme.colors.primary,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      color: theme.colors.text,
      fontSize: 20,
      backgroundColor: theme.colors.surface,
    },
    submit: {
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
    },
    submitDisabled: { opacity: 0.4 },
    submitText: { color: theme.colors.surface, fontSize: 18, fontWeight: "700" },
  });
}
