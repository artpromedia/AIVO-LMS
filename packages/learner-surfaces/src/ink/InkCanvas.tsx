import { useMemo } from "react";
import { type InkStroke } from "./stroke-model.js";
import { type InkTool, usePointerInk } from "./usePointerInk.js";
import type { SurfaceTelemetryEvent } from "../telemetry/surface-events.js";

export interface InkCanvasProps {
  surfaceId: string;
  width?: number;
  height?: number;
  disabled?: boolean;
  readOnly?: boolean;
  tool?: InkTool;
  color?: string;
  initialStrokes?: InkStroke[];
  onChange?: (strokes: InkStroke[]) => void;
  onEvent?: (event: SurfaceTelemetryEvent) => void;
  showToolbar?: boolean;
  onToolChange?: (tool: InkTool) => void;
}

function strokeToPath(stroke: InkStroke): string {
  if (stroke.points.length === 0) {
    return "";
  }

  const [first, ...rest] = stroke.points;
  const commands = [`M ${first.x} ${first.y}`];
  for (const point of rest) {
    commands.push(`L ${point.x} ${point.y}`);
  }
  return commands.join(" ");
}

const TOOLBAR_TOOLS: InkTool[] = ["pencil", "highlighter", "eraser"];

export function InkCanvas({
  surfaceId,
  width = 480,
  height = 280,
  disabled = false,
  readOnly = false,
  tool = "pencil",
  color,
  initialStrokes,
  onChange,
  onEvent,
  showToolbar = false,
  onToolChange,
}: InkCanvasProps) {
  const ink = usePointerInk({
    surfaceId,
    disabled: disabled || readOnly,
    initialStrokes,
    tool,
    color,
    onChange,
    onEvent,
  });

  const canvasLabel = useMemo(() => `${surfaceId}-ink-canvas`, [surfaceId]);

  return (
    <div>
      {showToolbar ? (
        <div
          role="toolbar"
          aria-label="Scratchpad tools"
          style={{ display: "flex", gap: 8, marginBottom: 8 }}
        >
          {TOOLBAR_TOOLS.map((toolbarTool) => (
            <button
              key={toolbarTool}
              type="button"
              aria-label={toolbarTool}
              aria-pressed={tool === toolbarTool}
              disabled={disabled || readOnly}
              onClick={() => onToolChange?.(toolbarTool)}
            >
              {toolbarTool}
            </button>
          ))}
          <button
            type="button"
            aria-label="undo"
            disabled={disabled || readOnly}
            onClick={ink.undo}
          >
            undo
          </button>
          <button
            type="button"
            aria-label="redo"
            disabled={disabled || readOnly}
            onClick={ink.redo}
          >
            redo
          </button>
          <button
            type="button"
            aria-label="clear"
            disabled={disabled || readOnly}
            onClick={ink.clear}
          >
            clear
          </button>
        </div>
      ) : null}

      <div
        role="application"
        aria-label={canvasLabel}
        style={{
          width,
          height,
          border: "1px solid #cbd5e1",
          borderRadius: 8,
          touchAction: "none",
          position: "relative",
          backgroundColor: "#fff",
        }}
        onPointerDown={ink.onPointerDown}
        onPointerMove={ink.onPointerMove}
        onPointerUp={ink.onPointerUp}
        onPointerCancel={ink.onPointerCancel}
      >
        <svg width={width} height={height} aria-hidden="true">
          {ink.strokes.map((stroke) => (
            <path
              key={stroke.id}
              d={strokeToPath(stroke)}
              fill="none"
              stroke={stroke.color ?? (stroke.tool === "highlighter" ? "#f59e0b" : "#1f2937")}
              strokeOpacity={stroke.tool === "highlighter" ? 0.4 : 1}
              strokeWidth={stroke.width}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
