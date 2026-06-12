"use client";

import * as React from "react";

/**
 * WorkspaceControl — the My Workspace segmented control.
 *
 * A true segmented control (one soft track + an elevated selected pill) that
 * matches the learner home's rounded, warm card language and the approved
 * /design-preview. Implements the WAI-ARIA radiogroup pattern: roving
 * tabindex, arrow-key navigation with wrap, Home/End, and selection conveyed
 * by color + shadow + ring + `aria-checked` (never color alone). 48px targets
 * satisfy WCAG 2.5.8. The live selected value is mirrored beside the label.
 *
 * Styling lives in app/learner-experience.css (`.lxws*`).
 */
export interface WorkspaceOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

export function WorkspaceControl({
  label,
  value,
  onChange,
  options,
  layout = "stack",
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: WorkspaceOption[];
  layout?: "stack" | "inline";
}) {
  const labelId = React.useId();
  const btnRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const activeLabel = options[activeIndex]?.label;

  function move(to: number) {
    const next = (to + options.length) % options.length;
    onChange(options[next].value);
    btnRefs.current[next]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        move(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        move(index - 1);
        break;
      case "Home":
        e.preventDefault();
        move(0);
        break;
      case "End":
        e.preventDefault();
        move(options.length - 1);
        break;
      default:
        break;
    }
  }

  return (
    <div className="lxws">
      <div className="lxws__head">
        <span id={labelId} className="lxws__label">
          {label}
        </span>
        <span className="lxws__value" aria-hidden="true">
          {activeLabel}
        </span>
      </div>
      <div role="radiogroup" aria-labelledby={labelId} className="lxws__track">
        {options.map((o, i) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              ref={(el) => {
                btnRefs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${label}: ${o.label}`}
              tabIndex={active ? 0 : -1}
              data-layout={layout}
              className="lxws__btn"
              onClick={() => onChange(o.value)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              {o.icon}
              <span>{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
