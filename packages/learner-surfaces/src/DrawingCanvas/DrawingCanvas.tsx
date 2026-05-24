import { useEffect, useMemo, useState } from "react";
import { InkCanvas } from "../ink/InkCanvas.js";
import { appendStrokePoint, createStroke, type InkStroke } from "../ink/stroke-model.js";
import { createSurfaceEvent, type SurfaceTelemetryEvent } from "../telemetry/surface-events.js";

const DEFAULT_HIGH_CONTRAST_PALETTE = ["#000000", "#FFFFFF", "#FFD700", "#00A3FF", "#D000FF"];

export interface DrawingCanvasProps {
  surfaceId: string;
  width: number;
  height: number;
  disabled?: boolean;
  palette: readonly string[];
  highContrastPalette?: readonly string[];
  showGuides?: boolean;
  largeText?: boolean;
  dyslexiaFriendlyFont?: boolean;
  reducedMotion?: boolean;
  onEvent?: (event: SurfaceTelemetryEvent) => void;
  onChange?: (strokes: InkStroke[]) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function DrawingCanvas({
  surfaceId,
  width,
  height,
  disabled = false,
  palette,
  highContrastPalette,
  showGuides = false,
  largeText = false,
  dyslexiaFriendlyFont = false,
  reducedMotion = false,
  onEvent,
  onChange,
}: DrawingCanvasProps) {
  const [tool, setTool] = useState<"pencil" | "eraser">("pencil");
  const [useHighContrastPalette, setUseHighContrastPalette] = useState(false);
  const colors = useMemo(
    () =>
      useHighContrastPalette
        ? (highContrastPalette ?? DEFAULT_HIGH_CONTRAST_PALETTE)
        : palette,
    [highContrastPalette, palette, useHighContrastPalette],
  );

  const [colorIndex, setColorIndex] = useState(0);
  const selectedColor = colors[Math.min(colorIndex, colors.length - 1)] ?? "#1B1B1B";
  const [pointerStrokes, setPointerStrokes] = useState<InkStroke[]>([]);
  const [keyboardStrokes, setKeyboardStrokes] = useState<InkStroke[]>([]);
  const [activeKeyboardStroke, setActiveKeyboardStroke] = useState<InkStroke | null>(null);
  const [cursor, setCursor] = useState({ x: Math.round(width / 2), y: Math.round(height / 2) });

  useEffect(() => {
    const all = activeKeyboardStroke
      ? [...pointerStrokes, ...keyboardStrokes, activeKeyboardStroke]
      : [...pointerStrokes, ...keyboardStrokes];
    onChange?.(all);
  }, [activeKeyboardStroke, keyboardStrokes, onChange, pointerStrokes]);

  useEffect(() => {
    setColorIndex((current) => Math.min(current, Math.max(0, colors.length - 1)));
  }, [colors.length]);

  function cycleColor(direction: 1 | -1) {
    if (colors.length === 0) return;
    setColorIndex((current) => {
      const next = (current + direction + colors.length) % colors.length;
      onEvent?.(createSurfaceEvent(surfaceId, "tool_changed", { color: colors[next] }));
      return next;
    });
  }

  function toggleTool(nextTool: "pencil" | "eraser") {
    setTool(nextTool);
    onEvent?.(createSurfaceEvent(surfaceId, "tool_changed", { tool: nextTool }));
  }

  function finishKeyboardStroke() {
    if (!activeKeyboardStroke) return;
    setKeyboardStrokes((current) => [...current, activeKeyboardStroke]);
    setActiveKeyboardStroke(null);
  }

  function moveCursor(dx: number, dy: number) {
    setCursor((current) => {
      const next = {
        x: clamp(current.x + dx, 0, width),
        y: clamp(current.y + dy, 0, height),
      };
      if (activeKeyboardStroke) {
        setActiveKeyboardStroke(appendStrokePoint(activeKeyboardStroke, { ...next, t: Date.now() }));
      }
      return next;
    });
  }

  const guidesStyle = showGuides
    ? {
        backgroundImage:
          "linear-gradient(to right, rgba(148,163,184,0.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.25) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
      }
    : undefined;

  const keyboardHelp =
    "Keyboard: P pen, E eraser, [ and ] change color, arrows move cursor, Space start/stop keyboard stroke.";

  return (
    <section
      aria-label="drawing-canvas"
      aria-describedby={`${surfaceId}-drawing-help`}
      tabIndex={0}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "p" || event.key === "P") {
          event.preventDefault();
          toggleTool("pencil");
          return;
        }
        if (event.key === "e" || event.key === "E") {
          event.preventDefault();
          toggleTool("eraser");
          return;
        }
        if (event.key === "[") {
          event.preventDefault();
          cycleColor(-1);
          return;
        }
        if (event.key === "]") {
          event.preventDefault();
          cycleColor(1);
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          moveCursor(0, -8);
          return;
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          moveCursor(0, 8);
          return;
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          moveCursor(-8, 0);
          return;
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          moveCursor(8, 0);
          return;
        }
        if (event.key === " ") {
          event.preventDefault();
          if (activeKeyboardStroke) {
            finishKeyboardStroke();
          } else if (tool !== "eraser") {
            setActiveKeyboardStroke(
              createStroke(
                "pencil",
                { ...cursor, t: Date.now() },
                3,
                undefined,
                selectedColor,
              ),
            );
          }
        }
      }}
      style={{
        fontSize: largeText ? "1.125rem" : undefined,
        fontFamily: dyslexiaFriendlyFont ? "monospace" : undefined,
      }}
    >
      <p id={`${surfaceId}-drawing-help`} style={{ fontSize: "0.875em" }}>
        {keyboardHelp}
      </p>
      <div role="toolbar" aria-label="drawing tools" style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <button
          type="button"
          aria-label="pen"
          aria-pressed={tool === "pencil"}
          disabled={disabled}
          onClick={() => toggleTool("pencil")}
        >
          Pen
        </button>
        <button
          type="button"
          aria-label="eraser"
          aria-pressed={tool === "eraser"}
          disabled={disabled}
          onClick={() => toggleTool("eraser")}
        >
          Eraser
        </button>
        <button
          type="button"
          aria-label="high contrast colors"
          aria-pressed={useHighContrastPalette}
          disabled={disabled}
          onClick={() => setUseHighContrastPalette((current) => !current)}
        >
          High contrast palette
        </button>
      </div>

      <div role="radiogroup" aria-label="color palette" style={{ marginBottom: 8 }}>
        {colors.map((color, idx) => {
          const isSelected = idx === colorIndex;
          return (
            <button
              type="button"
              key={color}
              role="radio"
              aria-checked={isSelected}
              aria-label={`color ${color}`}
              disabled={disabled}
              onClick={() => setColorIndex(idx)}
              style={{
                width: 28,
                height: 28,
                margin: 4,
                borderRadius: "50%",
                border: "1px solid #334155",
                background: color,
                outline: isSelected ? "2px solid #111827" : "none",
                transition: reducedMotion ? "none" : "outline 120ms ease-in-out",
              }}
            />
          );
        })}
      </div>

      <div style={{ position: "relative", width, height, ...guidesStyle }} data-testid="drawing-canvas-frame">
        <InkCanvas
          surfaceId={surfaceId}
          width={width}
          height={height}
          disabled={disabled}
          tool={tool}
          color={selectedColor}
          showToolbar
          onChange={setPointerStrokes}
          onEvent={onEvent}
        />
        <svg
          width={width}
          height={height}
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          aria-hidden="true"
        >
          {[...keyboardStrokes, ...(activeKeyboardStroke ? [activeKeyboardStroke] : [])].map((stroke) => {
            if (stroke.points.length === 0) return null;
            const [first, ...rest] = stroke.points;
            const d = [`M ${first.x} ${first.y}`, ...rest.map((p) => `L ${p.x} ${p.y}`)].join(" ");
            return (
              <path
                key={stroke.id}
                d={d}
                fill="none"
                stroke={stroke.color ?? "#1f2937"}
                strokeWidth={stroke.width}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}
          <circle cx={cursor.x} cy={cursor.y} r={4} fill="none" stroke="#111827" strokeWidth={1.5} />
        </svg>
      </div>
    </section>
  );
}
