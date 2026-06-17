"use client";

import * as React from "react";

/**
 * OtpInput — the row of individual digit boxes for the "Confirm it's you"
 * verification screen. Auto-advances on entry, supports backspace, arrow
 * keys, and pasting the whole code. A hidden input carries the joined value
 * to the surrounding (server-action) form under `name`.
 *
 * Token-driven: boxes use iw-* borders and the primary focus ring; the error
 * state rims every box in the danger color.
 */
export function OtpInput({
  name,
  length = 6,
  error = false,
  autoFocus = true,
  ariaLabel,
}: {
  name: string;
  length?: number;
  error?: boolean;
  autoFocus?: boolean;
  ariaLabel?: string;
}) {
  const [digits, setDigits] = React.useState<string[]>(() => Array.from({ length }, () => ""));
  const refs = React.useRef<Array<HTMLInputElement | null>>([]);
  const value = digits.join("");

  const setAt = (i: number, d: string) => {
    setDigits((prev) => {
      const next = [...prev];
      next[i] = d;
      return next;
    });
  };

  const handleChange = (i: number, raw: string) => {
    const d = raw.replace(/\D/g, "");
    if (!d) {
      setAt(i, "");
      return;
    }
    // If multiple chars arrive (autofill of full code), distribute them.
    if (d.length > 1) {
      const chars = d.slice(0, length - i).split("");
      setDigits((prev) => {
        const next = [...prev];
        chars.forEach((c, k) => {
          next[i + k] = c;
        });
        return next;
      });
      const last = Math.min(i + chars.length, length - 1);
      refs.current[last]?.focus();
      return;
    }
    setAt(i, d);
    if (i < length - 1) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (digits[i]) {
        setAt(i, "");
      } else if (i > 0) {
        refs.current[i - 1]?.focus();
        setAt(i - 1, "");
      }
    } else if (e.key === "ArrowLeft" && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < length - 1) {
      refs.current[i + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!text) return;
    e.preventDefault();
    setDigits(() => {
      const next = Array.from({ length }, (_, k) => text[k] ?? "");
      return next;
    });
    refs.current[Math.min(text.length, length - 1)]?.focus();
  };

  return (
    <div className="flex flex-col gap-1.5">
      <input type="hidden" name={name} value={value} />
      <div className="flex justify-center gap-2.5" role="group" aria-label={ariaLabel}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={i === 0 ? length : 1}
            value={d}
            autoFocus={autoFocus && i === 0}
            aria-label={`Digit ${i + 1}`}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
            className={[
              "h-13 w-11 rounded-iw-control border bg-white text-center text-xl font-bold tabular-nums text-iw-ink outline-none transition-colors sm:h-14 sm:w-12",
              error
                ? "border-iw-error focus:ring-2 focus:ring-iw-error/30"
                : "border-iw-border focus:border-iw-primary focus:ring-2 focus:ring-iw-primary/20",
            ].join(" ")}
          />
        ))}
      </div>
    </div>
  );
}

OtpInput.displayName = "Auth/OtpInput";
