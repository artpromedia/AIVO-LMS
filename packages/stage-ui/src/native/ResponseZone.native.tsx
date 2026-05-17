/**
 * ResponseZone.native.tsx — multiple-choice response area for React Native.
 * All touch targets are >= 44×44pt (WCAG 2.5.5).
 * Announces choices via accessibilityLabel when touch exploration is active.
 */
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  AccessibilityInfo,
} from "react-native";
import type { ChoiceOption } from "../types.js";

export interface ResponseZoneProps {
  choices: ChoiceOption[];
  onAnswer: (choiceId: string, isCorrect: boolean) => void;
  disabled?: boolean;
}

export function ResponseZone({ choices, onAnswer, disabled = false }: ResponseZoneProps) {
  const [touchExploring, setTouchExploring] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    // Use the cross-platform `screenReaderChanged` event (VoiceOver on iOS,
    // TalkBack on Android) instead of Android-only `touchExplorationDidChange`,
    // which isn't typed on AccessibilityInfoStatic. Same UX intent: when an
    // assistive screen reader is active we add the "Double tap to select"
    // hint to each choice's accessibility label.
    AccessibilityInfo.isScreenReaderEnabled()
      .then(setTouchExploring)
      .catch(() => {
        // If the platform refuses to report screen-reader state we fall
        // back to the conservative default (`false`) — the choices remain
        // tappable, only the verbose hint suffix is suppressed.
        setTouchExploring(false);
      });
    const sub = AccessibilityInfo.addEventListener("screenReaderChanged", (enabled: boolean) => {
      setTouchExploring(enabled);
    });
    return () => sub.remove();
  }, []);

  const handlePress = (choice: ChoiceOption) => {
    if (disabled || selected) return;
    setSelected(choice.id);
    onAnswer(choice.id, choice.isCorrect);
  };

  return (
    <View
      style={styles.container}
      accessible={false}
      accessibilityRole="none"
    >
      {choices.map((choice) => (
        <TouchableOpacity
          key={choice.id}
          style={[
            styles.choice,
            selected === choice.id && (choice.isCorrect ? styles.correct : styles.incorrect),
            disabled && styles.disabled,
          ]}
          onPress={() => handlePress(choice)}
          disabled={disabled || selected !== null}
          accessible
          accessibilityRole="button"
          accessibilityLabel={
            touchExploring
              ? `Choice: ${choice.emoji ?? ""} ${choice.label}. Double tap to select.`
              : choice.label
          }
          accessibilityState={{ selected: selected === choice.id, disabled: disabled || selected !== null }}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          {choice.emoji ? <Text style={styles.emoji}>{choice.emoji}</Text> : null}
          <Text style={styles.label}>{choice.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  choice: {
    minHeight: 56, // well above 44pt WCAG minimum
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 2,
    borderColor: "transparent",
  },
  correct: {
    backgroundColor: "rgba(34,197,94,0.25)",
    borderColor: "#22c55e",
  },
  incorrect: {
    backgroundColor: "rgba(239,68,68,0.25)",
    borderColor: "#ef4444",
  },
  disabled: {
    opacity: 0.6,
  },
  emoji: {
    fontSize: 22,
  },
  label: {
    color: "#f1f5f9",
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
});
