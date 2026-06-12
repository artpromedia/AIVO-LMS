/**
 * Beat dispatcher. Renders the appropriate input UI for a beat by kind.
 * Sprint 03+ adds surface beats; Sprint 04 wires the tutor protocol.
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useA11yStyle } from "@/lib/a11y-style";
import type { TierThemeMobile } from "@aivo/mobile-ui";
import type { Beat } from "@/src/types/stage";
import { MobileChoiceGrid } from "./MobileChoiceGrid";
import { MobileMathExpressionInput } from "./MobileMathExpressionInput";
import { MobileSurfaceRenderer } from "./surface-renderer";

interface Props {
  theme: TierThemeMobile;
  beat: Beat;
  selected: string | null;
  answered: boolean;
  submitting: boolean;
  onChoice: (answer: string) => void;
  onMathExpression: (expression: string) => void;
  onSurfaceSubmit: (commands: unknown) => void;
  onTutorTurnContinue: () => void;
}

export function MobileBeatRenderer(props: Props) {
  const { theme, beat } = props;
  const styles = createStyles(theme);
  const { bodyFontFamily } = useA11yStyle();

  if (beat.kind === "choice") {
    return (
      <View style={styles.wrap}>
        <Text style={[styles.question, { fontFamily: bodyFontFamily }]}>{beat.text}</Text>
        <MobileChoiceGrid
          theme={theme}
          options={beat.options}
          correctAnswer={beat.correctAnswer}
          selected={props.selected}
          answered={props.answered}
          submitting={props.submitting}
          onSelect={props.onChoice}
        />
      </View>
    );
  }

  if (beat.kind === "math-expression") {
    return (
      <MobileMathExpressionInput
        theme={theme}
        prompt={beat.text}
        disabled={props.answered || props.submitting}
        onSubmit={props.onMathExpression}
      />
    );
  }

  if (beat.kind === "surface") {
    return (
      <MobileSurfaceRenderer
        theme={theme}
        beat={beat}
        disabled={props.answered || props.submitting}
        onSubmit={props.onSurfaceSubmit}
      />
    );
  }

  // tutor-turn — render the line and let the runtime auto-advance.
  return (
    <View style={styles.wrap}>
      <Text style={[styles.tutorText, { fontFamily: bodyFontFamily }]}>{beat.text}</Text>
    </View>
  );
}

function createStyles(theme: TierThemeMobile) {
  return StyleSheet.create({
    wrap: { padding: 16, gap: 12 },
    question: { color: theme.colors.text, fontSize: 24, fontWeight: "700", textAlign: "center" },
    tutorText: { color: theme.colors.text, fontSize: 20, lineHeight: 28, padding: 16 },
  });
}
