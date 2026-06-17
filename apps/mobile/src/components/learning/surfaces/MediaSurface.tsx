/**
 * Sprint 13 — video/audio media surfaces (Sprint 9, moved verbatim). Video
 * uses expo-av native controls; audio uses a play/pause control.
 * Transcript/caption text is shown for accessibility. Submits a completion
 * ack so the lesson can advance.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Audio, Video, ResizeMode } from "expo-av";
import { colors } from "@/constants/colors";
import { createSurfaceStyles, readString } from "./shared";
import type { SurfaceProps } from "./types";

export function MediaSurface({ theme, surfaceKind, cfg, onSubmit }: SurfaceProps) {
  const styles = useMemo(() => createSurfaceStyles(theme), [theme]);
  const src = readString(cfg, "src", "");
  const transcript = readString(cfg, "transcript", readString(cfg, "captionText", ""));
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    return () => {
      const s = soundRef.current;
      soundRef.current = null;
      if (s) s.unloadAsync().catch(() => undefined);
    };
  }, []);

  const toggleAudio = async () => {
    try {
      if (!soundRef.current && src) {
        const { sound } = await Audio.Sound.createAsync({ uri: src });
        soundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((st) => {
          if ("didJustFinish" in st && st.didJustFinish) setPlaying(false);
        });
      }
      const s = soundRef.current;
      if (!s) return;
      if (playing) {
        await s.pauseAsync();
        setPlaying(false);
      } else {
        await s.playAsync();
        setPlaying(true);
      }
    } catch {
      // ignore playback errors; transcript remains available
    }
  };

  return (
    <View style={{ gap: 12 }}>
      {surfaceKind === "video" ? (
        src ? (
          <Video
            source={{ uri: src }}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            style={{
              width: "100%",
              aspectRatio: 16 / 9,
              borderRadius: 12,
              backgroundColor: colors.black,
            }}
          />
        ) : (
          <Text style={styles.note}>Media unavailable.</Text>
        )
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playing ? "pause audio" : "play audio"}
          onPress={toggleAudio}
          disabled={!src}
          style={[styles.submit, !src && styles.submitDisabled]}
        >
          <Text style={styles.submitText}>{playing ? "⏸ Pause" : "▶︎ Play"}</Text>
        </Pressable>
      )}
      {transcript ? (
        <Text style={styles.note} accessibilityLabel={`transcript: ${transcript}`}>
          {transcript}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="continue"
        onPress={() => onSubmit({ kind: "media_complete", surfaceKind })}
        style={styles.submit}
      >
        <Text style={styles.submitText}>Continue</Text>
      </Pressable>
    </View>
  );
}
