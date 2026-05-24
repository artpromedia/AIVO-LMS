import { useState } from "react";
import type { LearnerSurfaceSpec, SurfaceResponse } from "../types.js";
import { createSurfaceEvent, type SurfaceTelemetryEvent } from "../telemetry/surface-events.js";

export interface CodingSandboxSurfaceProps {
  surface: LearnerSurfaceSpec;
  disabled?: boolean;
  onSubmit?: (response: SurfaceResponse) => void;
  onEvent?: (event: SurfaceTelemetryEvent) => void;
}

/**
 * Sprint 8 — Coding sandbox surface.
 *
 * Purely a capture UI: the learner sees a starter snippet, edits it in
 * a monospace textarea, and presses Run/Submit. The code string is
 * sent back as `response.answer` so the tutor / learning service can
 * grade it (or hand it off to a sandbox executor) using the same
 * pipeline as any other text answer. No code is ever evaluated on the
 * client.
 */
export function CodingSandboxSurface({
  surface,
  disabled = false,
  onSubmit,
  onEvent,
}: CodingSandboxSurfaceProps) {
  const cfg = surface.codingSandbox;
  const [code, setCode] = useState<string>(cfg?.starterCode ?? "");
  const language = cfg?.language ?? "python";
  const submitDisabled =
    disabled || (surface.capture.finalAnswer && code.trim().length === 0);

  return (
    <section aria-label="coding-sandbox-surface" data-language={language}>
      <p>{surface.prompt}</p>
      {surface.instructions ? <p>{surface.instructions}</p> : null}
      {cfg?.prelude ? (
        <pre aria-label="coding sandbox prelude">
          <code>{cfg.prelude}</code>
        </pre>
      ) : null}
      <label>
        <span>{`Your ${language} code`}</span>
        <textarea
          aria-label={`code editor (${language})`}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          // Monospace + tab support via plain CSS is intentional — we
          // don't ship a heavy editor like Monaco into the learner
          // bundle on first paint; advanced editors come in later
          // sprints when the surface is opened.
          style={{ fontFamily: "var(--font-aivo-mono, ui-monospace, monospace)", width: "100%", minHeight: 240 }}
          value={code}
          disabled={disabled}
          onChange={(event) => {
            const next = event.currentTarget.value;
            setCode(next);
            onEvent?.(
              createSurfaceEvent(surface.id, "answer_changed", {
                length: next.length,
                language,
              }),
            );
          }}
          onKeyDown={(event) => {
            // Insert a real tab character rather than letting the
            // browser shift focus out of the editor.
            if (event.key === "Tab") {
              event.preventDefault();
              const target = event.currentTarget;
              const start = target.selectionStart;
              const end = target.selectionEnd;
              const next = code.slice(0, start) + "  " + code.slice(end);
              setCode(next);
              // Restore caret after the inserted tab on the next tick.
              requestAnimationFrame(() => {
                target.selectionStart = target.selectionEnd = start + 2;
              });
            }
          }}
        />
      </label>
      {cfg?.hint ? <p>{cfg.hint}</p> : null}
      <button
        type="button"
        aria-label="submit code"
        disabled={submitDisabled}
        onClick={() => {
          onEvent?.(
            createSurfaceEvent(surface.id, "surface_submitted", {
              language,
              length: code.length,
            }),
          );
          onSubmit?.({ surfaceId: surface.id, answer: code });
        }}
      >
        Submit code
      </button>
    </section>
  );
}
