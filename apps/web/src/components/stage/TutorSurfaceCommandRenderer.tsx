"use client";

import { useEffect, useMemo } from "react";
import type { SurfaceProtocolProfile, TutorSurfaceCommand } from "@aivo/tutor-surface-protocol";
import {
  SurfaceHost,
  type LearnerSurfaceSpec,
  type SurfaceResponse,
  type SurfaceTelemetryEvent,
} from "@aivo/learner-surfaces";
import {
  normalizeTutorSurfaceCommands,
  type NormalizedTutorCommand,
} from "./tutor-surface-command-normalizer";

export interface TutorSurfaceCommandRendererProps {
  commands: TutorSurfaceCommand[];
  profile?: SurfaceProtocolProfile;
  disabled?: boolean;
  /**
   * Optional: forwarded the normalized list so callers can also wire
   * snapshots back to the problem-session ledger.
   */
  onCommands?: (commands: NormalizedTutorCommand[]) => void;
  /**
   * Telemetry hook for rejected commands. Implementations MUST NOT include
   * raw payload, sensitive learner data, or free-form tutor text.
   */
  onRejected?: (
    rejected: Array<{ commandId?: string; surfaceId?: string; codes: string[] }>,
  ) => void;
  /**
   * Forwarded to each rendered SurfaceHost. Called when the learner submits
   * a response from any of the rendered surfaces. The associated surface
   * spec is forwarded so callers can run the scoring pipeline.
   */
  onSurfaceResponse?: (response: SurfaceResponse, surface: LearnerSurfaceSpec) => void;
  /**
   * Forwarded to each rendered SurfaceHost. Receives surface telemetry
   * events (surface_started, surface_submitted, ink_*, answer_changed,
   * tool_changed, unsupported_surface).
   */
  onSurfaceEvent?: (event: SurfaceTelemetryEvent) => void;
}

function commandToSurface(command: NormalizedTutorCommand): LearnerSurfaceSpec | null {
  const surface = command.command.surface;
  if (!surface) return null;
  // The protocol's `LearnerSurfaceSpec` is structurally compatible with the
  // `@aivo/learner-surfaces` runtime spec. We coerce because the protocol
  // is intentionally narrower (no Capture / Scoring required at the
  // protocol layer); SurfaceHost will fill in safe defaults.
  return surface as unknown as LearnerSurfaceSpec;
}

export function TutorSurfaceCommandRenderer({
  commands,
  profile,
  disabled = false,
  onCommands,
  onRejected,
  onSurfaceResponse,
  onSurfaceEvent,
}: TutorSurfaceCommandRendererProps) {
  const { normalized, rejected } = useMemo(
    () => normalizeTutorSurfaceCommands(commands, profile),
    [commands, profile],
  );

  // Notify callers once per render. `useEffect` here (not `useMemo` for side
  // effects) so React renders the surface tree below first.
  useEffect(() => {
    onCommands?.(normalized);
    if (rejected.length > 0 && onRejected) {
      onRejected(
        rejected.map((entry) => ({
          commandId: entry.commandId,
          surfaceId: entry.surfaceId,
          codes: entry.issues.map((issue) => issue.code),
        })),
      );
    }
  }, [normalized, rejected, onCommands, onRejected]);

  return (
    <div data-tutor-surface-renderer="true">
      {normalized
        .filter((cmd) => cmd.renderable)
        .map((cmd) => {
          const surface = commandToSurface(cmd);
          if (!surface) return null;
          return (
            <SurfaceHost
              key={cmd.command.id}
              surface={surface}
              disabled={disabled}
              onSubmit={(response) => onSurfaceResponse?.(response, surface)}
              onEvent={onSurfaceEvent}
            />
          );
        })}
    </div>
  );
}
