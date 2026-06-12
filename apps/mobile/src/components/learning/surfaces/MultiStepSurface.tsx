/**
 * Sprint 13 — multi-step workspace (Sprint 5 surface, moved verbatim):
 * per-step entry fields so the learner shows their work.
 */
import React, { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { createSurfaceStyles } from "./shared";
import type { SurfaceProps } from "./types";

interface StepDef {
  id: string;
  prompt: string;
  hint?: string;
}

export function MultiStepSurface({ theme, disabled, cfg, onSubmit }: SurfaceProps) {
  const styles = useMemo(() => createSurfaceStyles(theme), [theme]);
  const steps = (Array.isArray(cfg?.steps) ? (cfg!.steps as StepDef[]) : []).filter(
    (s) => s && typeof s.id === "string",
  );
  const [entries, setEntries] = useState<Record<string, string>>({});
  const filled = steps.filter((s) => (entries[s.id] ?? "").trim().length > 0).length;

  return (
    <View style={{ gap: 12 }}>
      {steps.map((step, i) => (
        <View key={step.id} style={{ gap: 6 }}>
          <Text style={{ color: theme.colors.text, fontWeight: "600" }}>
            Step {i + 1}. {step.prompt}
          </Text>
          <TextInput
            accessibilityLabel={`Step ${i + 1}: ${step.prompt}`}
            style={styles.textInput}
            editable={!disabled}
            value={entries[step.id] ?? ""}
            onChangeText={(v) => setEntries((p) => ({ ...p, [step.id]: v }))}
          />
        </View>
      ))}
      <Text style={styles.note}>
        {filled}/{steps.length} steps done
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="submit steps"
        disabled={disabled || filled < steps.length}
        onPress={() => onSubmit({ kind: "multi_step_workspace", entries })}
        style={[styles.submit, (disabled || filled < steps.length) && styles.submitDisabled]}
      >
        <Text style={styles.submitText}>I&apos;m done</Text>
      </Pressable>
    </View>
  );
}
