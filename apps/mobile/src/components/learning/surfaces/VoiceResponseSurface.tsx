/**
 * Sprint 13 — spoken response (Sprint 7 surface, moved verbatim). Records
 * via the existing `useSpeechInput` hook (expo-av → ai-svc transcribe),
 * shows the target word/phrase to say, supports record / stop / retry, and
 * submits the transcript.
 */
import React, { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { useSpeechInput } from "@/hooks/useSpeechInput";
import { createSurfaceStyles, readString } from "./shared";
import type { SurfaceProps } from "./types";

export function VoiceResponseSurface({ theme, disabled, cfg, onSubmit }: SurfaceProps) {
  const styles = useMemo(() => createSurfaceStyles(theme), [theme]);
  const targetText = readString(cfg, "targetText", "");
  const locale = readString(cfg, "language", readString(cfg, "locale", "en-US"));
  const speech = useSpeechInput({ locale });
  const listening = speech.status === "listening";
  const processing = speech.status === "processing";

  return (
    <View style={{ gap: 12 }}>
      {targetText ? (
        <Text
          style={[styles.body, { fontWeight: "700" }]}
          accessibilityLabel={`Say: ${targetText}`}
        >
          Say: “{targetText}”
        </Text>
      ) : null}

      {speech.transcript ? (
        <Text style={styles.body} accessibilityLabel={`You said ${speech.transcript}`}>
          You said: {speech.transcript}
        </Text>
      ) : (
        <Text style={styles.note}>
          {speech.isSupported
            ? "Tap the mic and say your answer out loud."
            : "Speaking isn't available on this device — type your answer instead."}
        </Text>
      )}
      {speech.error ? (
        <Text style={styles.note}>We couldn&apos;t hear that. Try again.</Text>
      ) : null}

      <View style={{ flexDirection: "row", gap: 12 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={listening ? "stop recording" : "start recording"}
          disabled={disabled || !speech.isSupported || processing}
          onPress={() => {
            if (listening) speech.stop().catch(() => undefined);
            else speech.start().catch(() => undefined);
          }}
          style={[
            styles.submit,
            { flex: 1 },
            listening && { backgroundColor: "#dc2626" },
            (disabled || !speech.isSupported || processing) && styles.submitDisabled,
          ]}
        >
          <Text style={styles.submitText}>
            {processing ? "…" : listening ? "Stop" : "🎤 Record"}
          </Text>
        </Pressable>
        {speech.transcript ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="try again"
            disabled={disabled || listening || processing}
            onPress={() => speech.reset()}
            style={[
              styles.submit,
              {
                flex: 1,
                backgroundColor: theme.colors.surface,
                borderWidth: 1,
                borderColor: theme.colors.text + "33",
              },
            ]}
          >
            <Text style={[styles.submitText, { color: theme.colors.text }]}>Try again</Text>
          </Pressable>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="submit spoken answer"
        disabled={disabled || !speech.transcript}
        onPress={() => onSubmit({ kind: "voice_response", transcript: speech.transcript })}
        style={[styles.submit, (disabled || !speech.transcript) && styles.submitDisabled]}
      >
        <Text style={styles.submitText}>I&apos;m done</Text>
      </Pressable>
    </View>
  );
}
