"use client";

import * as React from "react";

/**
 * PinDots — the row of filled/empty indicators above a PIN pad. The first
 * empty dot is ringed to show where the next digit lands.
 */
export function PinDots({
  length,
  filled,
  size = "md",
}: {
  length: number;
  filled: number;
  size?: "md" | "lg";
}) {
  const dot = size === "lg" ? "h-3.5 w-3.5" : "h-3 w-3";
  return (
    <div className="flex items-center justify-center gap-3" aria-hidden="true">
      {Array.from({ length }).map((_, i) => {
        const isFilled = i < filled;
        const isNext = i === filled;
        return (
          <span
            key={i}
            className={[
              dot,
              "rounded-full transition-colors",
              isFilled
                ? "bg-iw-primary"
                : isNext
                  ? "border-2 border-iw-primary"
                  : "bg-iw-border",
            ].join(" ")}
          />
        );
      })}
    </div>
  );
}

/**
 * PinKey — a single keypad button. `tone="digit"` is the calm white key;
 * `tone="accent"` is a soft-tinted utility key (clear / help / backspace).
 */
export function PinKey({
  children,
  onClick,
  ariaLabel,
  tone = "digit",
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  ariaLabel?: string;
  tone?: "digit" | "accent";
  className?: string;
}) {
  const tones =
    tone === "accent"
      ? "bg-iw-accent-soft text-iw-primary hover:bg-iw-accent-soft/80"
      : "bg-white text-iw-ink border border-iw-border hover:border-iw-primary hover:bg-iw-accent-soft/30";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={[
        "flex flex-col items-center justify-center gap-0.5 rounded-iw-control text-2xl font-semibold",
        "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-2 focus-visible:ring-offset-iw-bg",
        "active:scale-[0.97]",
        tones,
        className ?? "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/**
 * PinPad — the full controlled keypad: a row of PinDots over a 3×4 grid of
 * digit keys plus Clear / 0 / backspace. Fully controlled via `value` /
 * `onChange` so the surrounding page owns the PIN state (and can post it
 * through a hidden field to a server action). Digits stop accumulating at
 * `length`.
 */
export function PinPad({
  value,
  onChange,
  length = 4,
  clearLabel = "Clear",
  backspaceLabel = "Delete",
}: {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  clearLabel?: string;
  backspaceLabel?: string;
}) {
  const push = (d: string) => onChange(value.length >= length ? value : value + d);
  const back = () => onChange(value.slice(0, -1));
  const clear = () => onChange("");
  return (
    <div className="flex flex-col gap-6">
      <PinDots length={length} filled={value.length} size="lg" />
      <div className="mx-auto grid w-full max-w-[17rem] grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <PinKey key={d} onClick={() => push(d)} ariaLabel={d} className="h-16">
            {d}
          </PinKey>
        ))}
        <PinKey tone="accent" onClick={clear} ariaLabel={clearLabel} className="h-16 text-base">
          {clearLabel}
        </PinKey>
        <PinKey onClick={() => push("0")} ariaLabel="0" className="h-16">
          0
        </PinKey>
        <PinKey tone="accent" onClick={back} ariaLabel={backspaceLabel} className="h-16 text-2xl">
          ⌫
        </PinKey>
      </div>
    </div>
  );
}

/**
 * usePinInput — small controlled-state hook shared by the PIN screens.
 */
export function usePinInput(maxLength: number) {
  const [value, setValue] = React.useState("");
  const push = React.useCallback(
    (digit: string) => setValue((v) => (v.length >= maxLength ? v : v + digit)),
    [maxLength],
  );
  const backspace = React.useCallback(() => setValue((v) => v.slice(0, -1)), []);
  const clear = React.useCallback(() => setValue(""), []);
  return { value, setValue, push, backspace, clear };
}
