/**
 * Sprint 13 — coding sandbox (Sprint 8 surface, moved verbatim; the
 * language/starterCode parsing from the monolith's dispatch site lives
 * here now, same defaults).
 */
import React, { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { createSurfaceStyles, readString } from "./shared";
import type { SurfaceProps } from "./types";

export function CodingSandboxSurface({ theme, disabled, cfg, onSubmit }: SurfaceProps) {
  const styles = useMemo(() => createSurfaceStyles(theme), [theme]);
  const language = readString(cfg, "language", "python");
  const starterCode = readString(cfg, "starterCode", "");
  const [code, setCode] = useState<string>(starterCode);
  const canSubmit = code.trim().length > 0 && !disabled;
  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.codeLanguageBadge}>{language}</Text>
      <TextInput
        value={code}
        onChangeText={setCode}
        multiline
        editable={!disabled}
        autoCorrect={false}
        autoCapitalize="none"
        spellCheck={false}
        placeholder="// write your code here"
        placeholderTextColor={theme.colors.text + "80"}
        style={styles.codeInput}
        accessibilityLabel={`code editor (${language})`}
      />
      <Pressable
        accessibilityRole="button"
        onPress={() => onSubmit({ kind: "coding_sandbox", code, language })}
        disabled={!canSubmit}
        style={[styles.submit, !canSubmit && styles.submitDisabled]}
      >
        <Text style={styles.submitText}>Submit code</Text>
      </Pressable>
    </View>
  );
}
