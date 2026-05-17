import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GeometryCanvas, type GeometryShape } from './GeometryCanvas';
import { colors, radius, spacing } from '@/constants/colors';

/**
 * Normalized assessment-item schema. Mirrors the shape returned by
 * learning-svc so the same renderer is used for adaptive lessons, rubric
 * checks, and homework follow-ups.
 */
export type AssessmentItem =
  | MultipleChoiceItem
  | ShortAnswerItem
  | NumericItem
  | GeometryItem
  | OrderingItem
  | MultiSelectItem
  | FreeResponseItem;

interface BaseItem {
  id: string;
  prompt: string;
  hint?: string;
  /** Optional visual asset rendered above the prompt. */
  figure?: { width: number; height: number; shapes: GeometryShape[]; grid?: boolean; axes?: boolean };
}

export interface MultipleChoiceItem extends BaseItem {
  kind: 'multiple_choice';
  options: { id: string; label: string }[];
  correctOptionId: string;
}

export interface ShortAnswerItem extends BaseItem {
  kind: 'short_answer';
  acceptedAnswers: string[];
  caseSensitive?: boolean;
}

export interface NumericItem extends BaseItem {
  kind: 'numeric';
  answer: number;
  tolerance?: number;
  unit?: string;
}

export interface GeometryItem extends BaseItem {
  kind: 'geometry';
  /** A free-response geometry prompt — graded server-side. */
  rubric?: string;
}

export interface OrderingItem extends BaseItem {
  kind: 'ordering';
  options: { id: string; label: string }[];
  correctOrder: string[];
}

export interface MultiSelectItem extends BaseItem {
  kind: 'multi_select';
  options: { id: string; label: string }[];
  correctOptionIds: string[];
}

export interface FreeResponseItem extends BaseItem {
  kind: 'free_response';
  minWords?: number;
}

export interface AssessmentItemRendererProps {
  item: AssessmentItem;
  /** Fires when the learner submits an answer. */
  onSubmit: (
    submission:
      | { kind: 'multiple_choice'; optionId: string }
      | { kind: 'short_answer'; text: string }
      | { kind: 'numeric'; value: number }
      | { kind: 'geometry'; note: string }
      | { kind: 'ordering'; order: string[] }
      | { kind: 'multi_select'; optionIds: string[] }
      | { kind: 'free_response'; text: string },
    isCorrect: boolean | null,
  ) => void;
  /** Disable input (e.g. after submission). */
  disabled?: boolean;
  /** Highlight the correct answer after submit. */
  revealCorrect?: boolean;
  style?: ViewStyle;
}

/**
 * Render any normalized assessment item. Keeps the learner stage decoupled
 * from a single quiz format so the same screen can host geometry,
 * multi-select, ordering, numeric, and free-response items as the
 * adaptive engine produces them.
 */
export function AssessmentItemRenderer({
  item,
  onSubmit,
  disabled,
  revealCorrect,
  style,
}: AssessmentItemRendererProps) {
  return (
    <View style={[styles.container, style]}>
      {item.figure ? (
        <View style={styles.figureWrap}>
          <GeometryCanvas
            width={item.figure.width}
            height={item.figure.height}
            shapes={item.figure.shapes}
            grid={item.figure.grid}
            axes={item.figure.axes}
          />
        </View>
      ) : null}

      <Text style={styles.prompt}>{item.prompt}</Text>
      {item.hint ? (
        <View style={styles.hintRow}>
          <Ionicons name="bulb-outline" size={14} color={colors.warning} />
          <Text style={styles.hintText}>{item.hint}</Text>
        </View>
      ) : null}

      <ItemBody
        item={item}
        onSubmit={onSubmit}
        disabled={disabled}
        revealCorrect={revealCorrect}
      />
    </View>
  );
}

function ItemBody({
  item,
  onSubmit,
  disabled,
  revealCorrect,
}: AssessmentItemRendererProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());
  const [text, setText] = useState('');
  const [order, setOrder] = useState<string[]>(() =>
    item.kind === 'ordering' ? item.options.map((o) => o.id) : [],
  );

  switch (item.kind) {
    case 'multiple_choice': {
      return (
        <View style={styles.optionsGrid}>
          {item.options.map((opt) => {
            const isSelected = selected === opt.id;
            const isCorrect = revealCorrect && opt.id === item.correctOptionId;
            const isWrong = revealCorrect && isSelected && opt.id !== item.correctOptionId;
            return (
              <Pressable
                key={opt.id}
                disabled={disabled}
                onPress={() => {
                  setSelected(opt.id);
                  onSubmit(
                    { kind: 'multiple_choice', optionId: opt.id },
                    opt.id === item.correctOptionId,
                  );
                }}
                style={({ pressed }) => [
                  styles.optionCard,
                  isSelected && styles.optionSelected,
                  isCorrect && styles.optionCorrect,
                  isWrong && styles.optionWrong,
                  pressed && !disabled && { opacity: 0.85 },
                ]}
                accessibilityRole="button"
              >
                <Text style={styles.optionText}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>
      );
    }
    case 'multi_select': {
      const toggle = (id: string) => {
        setMultiSelected((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
      };
      const submit = () => {
        const ids = Array.from(multiSelected);
        const correct =
          ids.length === item.correctOptionIds.length &&
          item.correctOptionIds.every((id) => multiSelected.has(id));
        onSubmit({ kind: 'multi_select', optionIds: ids }, correct);
      };
      return (
        <View>
          <View style={styles.optionsGrid}>
            {item.options.map((opt) => {
              const isSelected = multiSelected.has(opt.id);
              return (
                <Pressable
                  key={opt.id}
                  disabled={disabled}
                  onPress={() => toggle(opt.id)}
                  style={[styles.optionCard, isSelected && styles.optionSelected]}
                >
                  <Ionicons
                    name={isSelected ? 'checkbox' : 'square-outline'}
                    size={18}
                    color={isSelected ? colors.primary : colors.textSecondary}
                  />
                  <Text style={[styles.optionText, { marginLeft: 8 }]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <SubmitBar onSubmit={submit} disabled={disabled || multiSelected.size === 0} />
        </View>
      );
    }
    case 'short_answer': {
      const submit = () => {
        const trimmed = text.trim();
        const correct = item.acceptedAnswers.some((a) =>
          item.caseSensitive ? a === trimmed : a.toLowerCase() === trimmed.toLowerCase(),
        );
        onSubmit({ kind: 'short_answer', text: trimmed }, correct);
      };
      return (
        <View>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Type your answer"
            placeholderTextColor={colors.textSecondary}
            editable={!disabled}
            style={styles.textInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <SubmitBar onSubmit={submit} disabled={disabled || !text.trim()} />
        </View>
      );
    }
    case 'numeric': {
      const submit = () => {
        const value = Number(text);
        if (Number.isNaN(value)) {
          onSubmit({ kind: 'numeric', value: NaN }, false);
          return;
        }
        const tolerance = item.tolerance ?? 0;
        const correct = Math.abs(value - item.answer) <= tolerance;
        onSubmit({ kind: 'numeric', value }, correct);
      };
      return (
        <View>
          <View style={styles.numericRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="0"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
              editable={!disabled}
              style={[styles.textInput, styles.numericInput]}
            />
            {item.unit ? <Text style={styles.unitText}>{item.unit}</Text> : null}
          </View>
          <SubmitBar onSubmit={submit} disabled={disabled || !text.trim()} />
        </View>
      );
    }
    case 'ordering': {
      const moveUp = (idx: number) => {
        if (idx === 0) return;
        setOrder((prev) => {
          const next = [...prev];
          [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
          return next;
        });
      };
      const moveDown = (idx: number) => {
        setOrder((prev) => {
          if (idx >= prev.length - 1) return prev;
          const next = [...prev];
          [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
          return next;
        });
      };
      const submit = () => {
        const correct = order.every((id, i) => id === item.correctOrder[i]);
        onSubmit({ kind: 'ordering', order }, correct);
      };
      return (
        <View>
          {order.map((id, i) => {
            const opt = item.options.find((o) => o.id === id);
            if (!opt) return null;
            return (
              <View key={id} style={styles.orderRow}>
                <Text style={styles.orderIndex}>{i + 1}.</Text>
                <Text style={styles.orderLabel}>{opt.label}</Text>
                <Pressable onPress={() => moveUp(i)} disabled={disabled || i === 0} style={styles.orderBtn}>
                  <Ionicons name="chevron-up" size={20} color={colors.text} />
                </Pressable>
                <Pressable
                  onPress={() => moveDown(i)}
                  disabled={disabled || i === order.length - 1}
                  style={styles.orderBtn}
                >
                  <Ionicons name="chevron-down" size={20} color={colors.text} />
                </Pressable>
              </View>
            );
          })}
          <SubmitBar onSubmit={submit} disabled={disabled} />
        </View>
      );
    }
    case 'geometry': {
      return (
        <View>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Describe your approach (we'll check your work on the scratchpad)"
            placeholderTextColor={colors.textSecondary}
            editable={!disabled}
            multiline
            style={[styles.textInput, styles.textArea]}
          />
          <SubmitBar
            onSubmit={() => onSubmit({ kind: 'geometry', note: text }, null)}
            disabled={disabled}
            label="Submit work"
          />
        </View>
      );
    }
    case 'free_response': {
      const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
      const meetsMin = !item.minWords || wordCount >= item.minWords;
      return (
        <View>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Write your response"
            placeholderTextColor={colors.textSecondary}
            editable={!disabled}
            multiline
            style={[styles.textInput, styles.textArea]}
          />
          {item.minWords ? (
            <Text style={styles.helperText}>
              {wordCount} / {item.minWords} words
            </Text>
          ) : null}
          <SubmitBar
            onSubmit={() => onSubmit({ kind: 'free_response', text }, null)}
            disabled={disabled || !meetsMin}
            label="Submit"
          />
        </View>
      );
    }
    default:
      return null;
  }
}

function SubmitBar({
  onSubmit,
  disabled,
  label = 'Check',
}: {
  onSubmit: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <Pressable
      onPress={onSubmit}
      disabled={disabled}
      style={[styles.submit, disabled && { opacity: 0.5 }]}
      accessibilityRole="button"
    >
      <Text style={styles.submitText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  figureWrap: { alignSelf: 'center' },
  prompt: { fontSize: 18, fontFamily: 'Nunito-ExtraBold', color: colors.text },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hintText: { fontSize: 13, fontFamily: 'Nunito-SemiBold', color: colors.warning, flex: 1 },
  optionsGrid: { gap: spacing.sm },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
  optionCorrect: { borderColor: colors.success, backgroundColor: colors.success + '14' },
  optionWrong: { borderColor: colors.error, backgroundColor: colors.error + '14' },
  optionText: { fontSize: 15, fontFamily: 'Nunito-Bold', color: colors.text, flex: 1 },
  textInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: 'Nunito-Regular',
    color: colors.text,
    backgroundColor: colors.card,
  },
  textArea: { minHeight: 96, textAlignVertical: 'top' },
  numericRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  numericInput: { flex: 1 },
  unitText: { fontSize: 16, fontFamily: 'Nunito-Bold', color: colors.text },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
    gap: 8,
  },
  orderIndex: { fontSize: 14, fontFamily: 'Nunito-Bold', color: colors.primary, width: 22 },
  orderLabel: { fontSize: 14, fontFamily: 'Nunito-SemiBold', color: colors.text, flex: 1 },
  orderBtn: { padding: 6 },
  helperText: { fontSize: 12, fontFamily: 'Nunito-Regular', color: colors.textSecondary, marginTop: 4 },
  submit: {
    marginTop: spacing.sm,
    paddingVertical: 14,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  submitText: { fontSize: 15, fontFamily: 'Nunito-Bold', color: '#FFF' },
});
