/**
 * StageLayout.native.tsx — React Native equivalent of StageLayout.tsx
 * Metro's platform extension resolution automatically prefers this file
 * over StageLayout.tsx when bundling for React Native.
 */
import React from "react";
import { View, StyleSheet, SafeAreaView, StatusBar, AccessibilityInfo } from "react-native";
import type { SessionPhase, TutorState, Beat, SensoryAdaptations, FunctioningLevel } from "../types.js";

export interface StageLayoutProps {
  phase: SessionPhase;
  tutorState: TutorState;
  currentBeat: Beat | null;
  progress: number;
  totalBeats: number;
  currentBeatIndex: number;
  functioningLevel: FunctioningLevel;
  adaptations: SensoryAdaptations;
  children?: React.ReactNode;
  onAnswer?: (correct: boolean) => void;
}

export function StageLayout({ children, adaptations }: StageLayoutProps) {
  const reducedMotion = adaptations?.motionReduced ?? false;

  return (
    <SafeAreaView style={styles.safeArea} accessibilityRole="none">
      <StatusBar barStyle="light-content" backgroundColor="#1e1b4b" />
      <View
        style={[styles.container, reducedMotion && styles.reducedMotion]}
        accessibilityLabel="Stage screen"
        accessibilityRole="none"
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#1e1b4b",
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  reducedMotion: {
    // Calmer palette for sensory-sensitive learners
    backgroundColor: "#0f172a",
  },
});
