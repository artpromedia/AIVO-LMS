/**
 * Multiple-choice grid for ChoiceBeat. Two columns on tablet/phone, with
 * visual feedback for selected / correct / incorrect.
 */

import React from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useA11yStyle } from "@/lib/a11y-style";
import { useScanTarget } from "@/src/components/switch-scan/ScanTargetRegistry";
import type { TierThemeMobile } from "@aivo/mobile-ui";
import { colors } from "@/constants/colors";

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
      {options.map((answer, index) => (
        <ChoiceCard
          key={answer}
          answer={answer}
          index={index}
          styles={styles}
          theme={theme}
          selected={selected}
          correctAnswer={correctAnswer}
          answered={answered}
          submitting={submitting}
          onSelect={onSelect}
        />
      ))}
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
    answerCorrect: { backgroundColor: colors.success, borderColor: colors.success },
    answerWrong: { backgroundColor: colors.error, borderColor: colors.error },
    answerRevealCorrect: { borderColor: colors.success },
    answerText: { color: theme.colors.text, fontSize: 22, fontWeight: "600" },
  });
}

// Each answer is a switch-scan target (Sprint A4): the overlay highlights
// and announces it, and switch activation selects it — same path as touch.
function ChoiceCard({
  answer,
  index,
  styles,
  theme,
  selected,
  correctAnswer,
  answered,
  submitting,
  onSelect,
}: {
  answer: string;
  index: number;
  styles: ReturnType<typeof createStyles>;
  theme: Props["theme"];
  selected: string | null;
  correctAnswer: string | undefined;
  answered: boolean;
  submitting: boolean;
  onSelect: (answer: string) => void;
}) {
  const { bodyFontFamily } = useA11yStyle();
  const isSelected = selected === answer;
  const isCorrect = answer === correctAnswer;
  const showResult = answered && isSelected;
  const scanRef = useScanTarget({
    id: `stage-choice-${index}`,
    label: answer,
    order: 10 + index,
    onActivate: () => onSelect(answer),
    disabled: answered,
  });
  return (
    <Pressable
      ref={scanRef}
      accessibilityRole="button"
      accessibilityLabel={answer}
      accessibilityState={{ selected: isSelected, disabled: answered }}
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
        <Text
          style={[
            styles.answerText,
            { fontFamily: bodyFontFamily },
            showResult && { color: theme.colors.surface },
          ]}
        >
          {answer}
        </Text>
      )}
    </Pressable>
  );
}
