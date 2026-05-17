/**
 * ResponseZone.tsx — web (DOM) version of the multiple-choice tile grid.
 * Each choice is a real `<button>` so it inherits keyboard focus, Enter/Space
 * activation, and screen-reader role for free. Touch targets are at least
 * 44×44px (WCAG 2.5.5).
 */
import React, { useState } from "react";
import type { ChoiceOption } from "./types.js";

export interface ResponseZoneProps {
  choices: ChoiceOption[];
  onAnswer: (choiceId: string, isCorrect: boolean) => void;
  disabled?: boolean;
}

export function ResponseZone({ choices, onAnswer, disabled = false }: ResponseZoneProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (choice: ChoiceOption) => {
    if (disabled || selected) return;
    setSelected(choice.id);
    onAnswer(choice.id, choice.isCorrect);
  };

  return (
    <div
      className="aivo-response-zone"
      role="group"
      aria-label="Answer choices"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "0 16px 16px",
      }}
    >
      {choices.map((choice) => {
        const isSelected = selected === choice.id;
        const showCorrect = isSelected && choice.isCorrect;
        const showIncorrect = isSelected && !choice.isCorrect;
        const bg = showCorrect
          ? "rgba(34,197,94,0.25)"
          : showIncorrect
            ? "rgba(239,68,68,0.25)"
            : "rgba(255,255,255,0.12)";
        const border = showCorrect
          ? "2px solid #22c55e"
          : showIncorrect
            ? "2px solid #ef4444"
            : "2px solid transparent";
        const isDisabled = disabled || selected !== null;
        return (
          <button
            key={choice.id}
            type="button"
            disabled={isDisabled}
            aria-pressed={isSelected}
            aria-label={choice.label}
            onClick={() => handleSelect(choice)}
            style={{
              minHeight: 56,
              backgroundColor: bg,
              borderRadius: 12,
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              border,
              color: "#f1f5f9",
              fontSize: 16,
              fontWeight: 600,
              textAlign: "left",
              cursor: isDisabled ? "default" : "pointer",
              opacity: isDisabled && !isSelected ? 0.6 : 1,
              outlineOffset: 2,
              font: "inherit",
            }}
          >
            {choice.emoji ? (
              <span aria-hidden="true" style={{ fontSize: 22 }}>
                {choice.emoji}
              </span>
            ) : null}
            <span style={{ flex: 1 }}>{choice.label}</span>
          </button>
        );
      })}
    </div>
  );
}
