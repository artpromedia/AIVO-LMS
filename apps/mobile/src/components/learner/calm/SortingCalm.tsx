import React, { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Card, Button } from "@/components/ui";
import { useTranslation } from "@/hooks/useTranslation";
import { useSensoryPalette } from "@/context/SensoryModeProvider";
import {
  SORTING_DEFAULT_COUNT,
  generateSortingItems,
  isSortingSolved,
  type SortItem,
} from "@/lib/calm";
import { spacing, radius } from "@/constants/colors";
import { fontFamilies } from "@/constants/typography";

/**
 * Sorting Calm — arrange the dots smallest → largest (mobile parity for the
 * web game). Fully operable via per-item "move left / move right" controls
 * (no drag, which is hard with assistive tech). No score, no timer, no lose
 * state: it ends gently the moment the row is in order, or when the learner
 * taps done.
 */
export function SortingCalm({
  onDone,
  onCancel,
}: {
  onDone: (secondsSpent: number) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const palette = useSensoryPalette();
  const startedAt = useRef<number>(Date.now());
  const [items, setItems] = useState<SortItem[]>(() =>
    generateSortingItems(Math.random, SORTING_DEFAULT_COUNT),
  );
  const [solved, setSolved] = useState(false);

  const move = useCallback(
    (index: number, dir: -1 | 1) => {
      if (solved) return;
      const target = index + dir;
      if (target < 0 || target >= items.length) return;
      const next = [...items];
      const tmp = next[index];
      next[index] = next[target];
      next[target] = tmp;
      setItems(next);
      if (isSortingSolved(next)) {
        setSolved(true);
        const secs = Math.round((Date.now() - startedAt.current) / 1000);
        setTimeout(() => onDone(secs), 900);
      }
    },
    [items, solved, onDone],
  );

  const maxValue = items.reduce((m, it) => Math.max(m, it.value), 1);

  return (
    <Card tone="raised" style={styles.card}>
      <Text style={[styles.title, { color: palette.ink }]}>
        {t("learnerCalm.games.sorting_title")}
      </Text>
      <Text accessibilityLiveRegion="polite" style={[styles.status, { color: palette.ink }]}>
        {solved ? t("learnerCalm.games.nice") : t("learnerCalm.games.sorting_prompt")}
      </Text>

      <View
        style={styles.tray}
        accessibilityRole="none"
        accessibilityLabel={t("learnerCalm.games.sorting_tray_aria")}
      >
        {items.map((item, index) => {
          const size = 32 + Math.round((item.value / maxValue) * 40);
          return (
            <View key={item.id} style={styles.itemCol}>
              <View
                accessibilityElementsHidden
                style={[
                  styles.dot,
                  {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: palette.primary + "33",
                  },
                ]}
              >
                <Text style={[styles.dotValue, { color: palette.ink }]}>{item.value}</Text>
              </View>
              <View style={styles.moveRow}>
                <Pressable
                  disabled={index === 0 || solved}
                  onPress={() => move(index, -1)}
                  accessibilityRole="button"
                  accessibilityLabel={t("learnerCalm.games.sorting_move_left", {
                    value: item.value,
                  })}
                  style={[
                    styles.moveBtn,
                    { borderColor: palette.border, backgroundColor: palette.bgPage },
                    (index === 0 || solved) && styles.moveBtnDisabled,
                  ]}
                >
                  <Text style={[styles.moveGlyph, { color: palette.ink }]}>←</Text>
                </Pressable>
                <Pressable
                  disabled={index === items.length - 1 || solved}
                  onPress={() => move(index, 1)}
                  accessibilityRole="button"
                  accessibilityLabel={t("learnerCalm.games.sorting_move_right", {
                    value: item.value,
                  })}
                  style={[
                    styles.moveBtn,
                    { borderColor: palette.border, backgroundColor: palette.bgPage },
                    (index === items.length - 1 || solved) && styles.moveBtnDisabled,
                  ]}
                >
                  <Text style={[styles.moveGlyph, { color: palette.ink }]}>→</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.actions}>
        <Button
          title={t("learnerCalm.games.done")}
          onPress={() => onDone(Math.round((Date.now() - startedAt.current) / 1000))}
        />
        <Button
          variant="outline"
          title={t("learnerCalm.games.go_back")}
          onPress={onCancel}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.lg,
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
  },
  title: { fontSize: 22, fontFamily: fontFamilies.displayBold, textAlign: "center" },
  status: {
    minHeight: 24,
    fontSize: 15,
    fontFamily: fontFamilies.bodyBold,
    textAlign: "center",
  },
  tray: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: spacing.sm,
  },
  itemCol: { alignItems: "center", gap: spacing.sm },
  dot: { alignItems: "center", justifyContent: "center" },
  dotValue: { fontSize: 14, fontFamily: fontFamilies.bodyBold },
  moveRow: { flexDirection: "row", gap: 4 },
  moveBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  moveBtnDisabled: { opacity: 0.4 },
  moveGlyph: { fontSize: 18 },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.sm,
  },
});
