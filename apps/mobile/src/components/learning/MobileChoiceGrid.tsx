/**
 * Multiple-choice grid for ChoiceBeat. Two columns on tablet/phone, with
 * visual feedback for selected / correct / incorrect.
 */

import React from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import type { TierThemeMobile } from "@aivo/mobile-ui";

interface Props {
  theme: TierThemeMobile;
  options: string[];
  correctAnswer: string;
  selected: string | null;
  answered: boolean;
  submitting: boolean;
  onSelect: (answer: string) => void;
}

export function MobileChoiceGrid({
  theme,
  options,
  correctAnswer,
  selected,
  answered,
  submitting,
  onSelect,
}: Props) {
  const styles = createStyles(theme);
  return (
    <View style={styles.responseZone}>
      {options.map((answer) => {
        const isSelected = selected === answer;
        const isCorrect = answer === correctAnswer;
        const showResult = answered && isSelected;
        return (
          <Pressable
            key={answer}
            accessibilityRole="button"
            accessibilityLabel={`Answer ${answer}`}
            style={({ pressed }) => [
              styles.answerCard,
              pressed && !answered && styles.answerPressed,
              showResult && isCorrect && styles.answerCorrect,
              showResult && !isCorrect && styles.answerWrong,
              answered && !isSelected && isCorrect && styles.answerRevealCorrect,
            ]}
            onPress={() => onSelect(answer)}
            disabled={answered}
          >
            {submitting && isSelected ? (
              <ActivityIndicator color={theme.colors.surface} />
            ) : (
              <Text style={[styles.answerText, showResult && { color: theme.colors.surface }]}>
                {answer}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(theme: TierThemeMobile) {
  return StyleSheet.create({
    responseZone: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
      justifyContent: "center",
      padding: 12,
    },
    answerCard: {
      width: "47%",
      minHeight: 72,
      borderRadius: 16,
      backgroundColor: theme.colors.surface,
      borderWidth: 2,
      borderColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
      padding: 12,
    },
    answerPressed: { opacity: 0.8 },
    answerCorrect: { backgroundColor: "#2e7d32", borderColor: "#2e7d32" },
    answerWrong: { backgroundColor: "#c62828", borderColor: "#c62828" },
    answerRevealCorrect: { borderColor: "#2e7d32" },
    answerText: { color: theme.colors.text, fontSize: 22, fontWeight: "600" },
  });
}
