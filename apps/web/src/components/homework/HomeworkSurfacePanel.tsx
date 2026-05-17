"use client";

import { SurfaceHost, type LearnerSurfaceSpec, type SurfaceResponse } from "@aivo/learner-surfaces";

export interface HomeworkSurfacePanelProps {
  surface: LearnerSurfaceSpec | null;
  disabled?: boolean;
  onSubmit?: (response: SurfaceResponse) => void;
}

/**
 * Renders the recommended learner surface for the current homework step.
 * When no surface is active the panel shows a calm placeholder so the
 * layout stays stable across steps.
 */
export function HomeworkSurfacePanel({ surface, disabled = false, onSubmit }: HomeworkSurfacePanelProps) {
  if (!surface) {
    return (
      <div className="homework-surface-panel-empty rounded border border-dashed p-4 text-sm text-gray-600">
        No surface yet. Move to the Plan step to choose one.
      </div>
    );
  }
  return (
    <div className="homework-surface-panel">
      <SurfaceHost surface={surface} disabled={disabled} onSubmit={onSubmit} />
    </div>
  );
}

export default HomeworkSurfacePanel;
