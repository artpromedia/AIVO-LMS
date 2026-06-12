/** Sprint 13 — free-text answer with a submit affordance (moved verbatim). */
import React, { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { createSurfaceStyles } from "./shared";
import type { SurfaceProps } from "./types";

export function TextResponseSurface({ theme, disabled, onSubmit }: SurfaceProps) {
  const styles = useMemo(() => createSurfaceStyles(theme), [theme]);
  const [text, setText] = useState("");
  const canSubmit = text.trim().length > 0 && !disabled;
  return (
    <View style={{ gap: 12 }}>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        editable={!disabled}
        placeholder="Type your answer…"
        placeholderTextColor={theme.colors.text + "80"}
        style={styles.textInput}
        accessibilityLabel="Your answer"
      />
      <Pressable
        accessibilityRole="button"
        onPress={() => onSubmit({ kind: "text_response", text: text.trim() })}
        disabled={!canSubmit}
        style={[styles.submit, !canSubmit && styles.submitDisabled]}
      >
        <Text style={styles.submitText}>Submit answer</Text>
      </Pressable>
    </View>
  );
}
