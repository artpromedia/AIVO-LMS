"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  SORTING_DEFAULT_COUNT,
  type SortItem,
  generateSortingItems,
  isSortingSolved,
} from "@/lib/learner/calm";

/**
 * Sorting Calm — arrange the dots smallest → largest. Fully keyboard
 * operable via per-item "move left / move right" controls (no drag, which
 * is hard with assistive tech). No score, no timer, no lose state: it ends
 * gently the moment the row is in order, or whenever the learner taps done.
 */
export function SortingCalm({
  onDone,
  onCancel,
}: Readonly<{
  onDone: (secondsSpent: number) => void;
  onCancel: () => void;
}>) {
  const t = useTranslations("learner.calm.games");
  const startedAt = useRef<number>(Date.now());
  const [reducedMotion, setReducedMotion] = useState(false);
  const [items, setItems] = useState<SortItem[]>(() =>
    generateSortingItems(Math.random, SORTING_DEFAULT_COUNT),
  );
  const [solved, setSolved] = useState(false);

  useEffect(() => {
    if (!("window" in globalThis)) return;
    const mq = globalThis.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

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
        globalThis.setTimeout(() => onDone(secs), 900);
      }
    },
    [items, solved, onDone],
  );

  const maxValue = items.reduce((m, it) => Math.max(m, it.value), 1);

  return (
    <Card className="mt-6 flex flex-col items-center gap-5 p-6 text-center">
      <h2 className="font-display text-2xl font-bold">{t("sorting_title")}</h2>
      <p role="status" aria-live="polite" className="min-h-6 font-medium">
        {solved ? t("nice") : t("sorting_prompt")}
      </p>

      <ol
        className="flex items-end justify-center gap-3"
        aria-label={t("sorting_tray_aria")}
      >
        {items.map((item, index) => {
          const size = 32 + Math.round((item.value / maxValue) * 40);
          return (
            <li key={item.id} className="flex flex-col items-center gap-2">
              <span
                aria-hidden="true"
                className={
                  "flex items-center justify-center rounded-full bg-iw-primary/30 " +
                  "text-sm font-semibold text-iw-text-strong " +
                  (reducedMotion ? "" : "transition-all duration-300")
                }
                style={{ width: size, height: size }}
              >
                {item.value}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={index === 0 || solved}
                  onClick={() => move(index, -1)}
                  aria-label={t("sorting_move_left", { value: item.value })}
                  className="flex h-11 w-11 items-center justify-center rounded-iw-control border border-iw-border bg-white text-lg text-iw-text-strong focus:outline-none focus:ring-2 focus:ring-iw-primary focus:ring-offset-2 disabled:opacity-40"
                >
                  ←
                </button>
                <button
                  type="button"
                  disabled={index === items.length - 1 || solved}
                  onClick={() => move(index, 1)}
                  aria-label={t("sorting_move_right", { value: item.value })}
                  className="flex h-11 w-11 items-center justify-center rounded-iw-control border border-iw-border bg-white text-lg text-iw-text-strong focus:outline-none focus:ring-2 focus:ring-iw-primary focus:ring-offset-2 disabled:opacity-40"
                >
                  →
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={() => onDone(Math.round((Date.now() - startedAt.current) / 1000))}>
          {t("done")}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          {t("go_back")}
        </Button>
      </div>
    </Card>
  );
}
