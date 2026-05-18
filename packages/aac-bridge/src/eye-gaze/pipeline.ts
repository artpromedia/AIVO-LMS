/**
 * End-to-end eye-gaze pipeline for `aac-bridge` (§9.3 Greenfield 8w).
 *
 * Three composable modules:
 *
 *   1. `CalibrationState` — tracks the 5- or 9-point calibration session a
 *      learner runs at the start of each gaze session. Stores per-point
 *      offsets and an aggregate accuracy score so the runtime can refuse
 *      to start when accuracy < 0.6.
 *
 *   2. `GazeTargetMapper` — maps a (screen-space x, y) gaze point to one
 *      of the registered AAC targets. Uses an axis-aligned bounding-box
 *      hit-test plus a Gaussian preference for the box centre so noisy
 *      gaze data still resolves the most likely target.
 *
 *   3. `DwellClickController` — accumulates time-on-target and emits a
 *      `click` event when continuous dwell ≥ `dwellMs`. Resets when the
 *      gaze leaves the target or when the learner blinks (long blink
 *      detected via missing-frame heuristic).
 *
 * These are pure-TS, framework-free. The existing `TobiiAdapter` wires
 * them into its WebSocket gaze stream via `attachEyeGazePipeline()`.
 */
export type GazeFrame = {
  /** Screen-space x in CSS pixels relative to the viewport. */
  x: number;
  /** Screen-space y in CSS pixels. */
  y: number;
  /** Vendor timestamp, ms since epoch. */
  t: number;
  /** Vendor-reported confidence 0..1. */
  confidence?: number;
  /** Vendor-reported "looking at screen" flag (Tobii calls this `presence`). */
  present?: boolean;
};

export type GazeTarget = {
  id: string;
  /** Target rect in screen-space CSS pixels. */
  x: number;
  y: number;
  width: number;
  height: number;
};

export interface GazeClickEvent {
  targetId: string;
  /** Total continuous dwell time, ms. */
  dwellMs: number;
  /** Average gaze confidence over the dwell window. */
  confidence: number;
  /** Vendor timestamp at the moment dwell threshold was crossed. */
  timestamp: number;
}

// ── Calibration ───────────────────────────────────────────────────────

export interface CalibrationPoint {
  /** Index in the calibration sequence (0..N-1). */
  i: number;
  /** Target screen-space coords the learner was asked to look at. */
  targetX: number;
  targetY: number;
  /** Mean of the gaze samples captured while target was visible. */
  measuredX: number;
  measuredY: number;
  /** Sample count at this point. */
  samples: number;
}

export class CalibrationState {
  private points: CalibrationPoint[] = [];
  private current: {
    i: number;
    targetX: number;
    targetY: number;
    xs: number[];
    ys: number[];
  } | null = null;

  /** Start collecting samples for the next calibration point. */
  beginPoint(i: number, targetX: number, targetY: number): void {
    this.current = { i, targetX, targetY, xs: [], ys: [] };
  }

  /** Feed a gaze frame into the currently-open calibration point. */
  acceptSample(frame: GazeFrame): void {
    if (!this.current) return;
    if (frame.present === false) return;
    this.current.xs.push(frame.x);
    this.current.ys.push(frame.y);
  }

  /** Finalize the currently-open calibration point. */
  endPoint(): CalibrationPoint | null {
    const c = this.current;
    if (!c) return null;
    if (c.xs.length === 0) {
      this.current = null;
      return null;
    }
    const measuredX = c.xs.reduce((a, b) => a + b, 0) / c.xs.length;
    const measuredY = c.ys.reduce((a, b) => a + b, 0) / c.ys.length;
    const point: CalibrationPoint = {
      i: c.i,
      targetX: c.targetX,
      targetY: c.targetY,
      measuredX,
      measuredY,
      samples: c.xs.length,
    };
    this.points.push(point);
    this.current = null;
    return point;
  }

  /**
   * Aggregate accuracy 0..1 — `1 - normalizedError`. We normalize each
   * point's offset by half the screen diagonal so a cross-screen error
   * yields ~0 and a perfect calibration yields 1.
   */
  accuracy(viewportWidth: number, viewportHeight: number): number {
    if (this.points.length === 0) return 0;
    const norm = Math.hypot(viewportWidth, viewportHeight) / 2;
    if (norm === 0) return 0;
    let sumErr = 0;
    for (const p of this.points) {
      sumErr += Math.hypot(p.measuredX - p.targetX, p.measuredY - p.targetY);
    }
    const meanErr = sumErr / this.points.length;
    return Math.max(0, Math.min(1, 1 - meanErr / norm));
  }

  /** Collected calibration points (for debugging / persistence). */
  snapshot(): readonly CalibrationPoint[] {
    return this.points.slice();
  }

  /** Compute a global linear correction (additive offset) from all points. */
  globalOffset(): { dx: number; dy: number } {
    if (this.points.length === 0) return { dx: 0, dy: 0 };
    let sx = 0,
      sy = 0;
    for (const p of this.points) {
      sx += p.measuredX - p.targetX;
      sy += p.measuredY - p.targetY;
    }
    return { dx: -sx / this.points.length, dy: -sy / this.points.length };
  }

  reset(): void {
    this.points = [];
    this.current = null;
  }
}

// ── Target mapper ─────────────────────────────────────────────────────

export class GazeTargetMapper {
  private targets: GazeTarget[] = [];
  private offset: { dx: number; dy: number } = { dx: 0, dy: 0 };

  setTargets(targets: readonly GazeTarget[]): void {
    this.targets = targets.slice();
  }

  setCalibrationOffset(o: { dx: number; dy: number }): void {
    this.offset = { ...o };
  }

  /**
   * Map a frame to the most likely target id, or null if none. Implements:
   *  1. Apply the calibration offset.
   *  2. Find any rect that contains the corrected point.
   *  3. If no rect contains it, pick the *closest centre* if its distance
   *     is within `pickRadiusPx` (default 32px). Otherwise return null.
   */
  resolve(frame: GazeFrame, pickRadiusPx = 32): string | null {
    const x = frame.x + this.offset.dx;
    const y = frame.y + this.offset.dy;
    // Direct hit-test first.
    for (const t of this.targets) {
      if (x >= t.x && x <= t.x + t.width && y >= t.y && y <= t.y + t.height) {
        return t.id;
      }
    }
    // Fallback: nearest centre within radius.
    let best: { id: string; dist: number } | null = null;
    for (const t of this.targets) {
      const cx = t.x + t.width / 2;
      const cy = t.y + t.height / 2;
      const d = Math.hypot(cx - x, cy - y);
      if (d <= pickRadiusPx && (!best || d < best.dist)) {
        best = { id: t.id, dist: d };
      }
    }
    return best?.id ?? null;
  }
}

// ── Dwell-click controller ────────────────────────────────────────────

export interface DwellClickConfig {
  /** Required continuous dwell, ms. */
  dwellMs: number;
  /** Maximum gap between gaze frames before dwell resets, ms. Set roughly
   *  to ~3× expected frame interval (gaze hardware drops frames during
   *  blinks, that's fine; a long blink should reset). */
  maxFrameGapMs?: number;
  /** Minimum vendor-reported confidence to accept a frame. */
  minConfidence?: number;
}

export class DwellClickController {
  private current: {
    targetId: string;
    startedAt: number;
    lastSeenAt: number;
    confSum: number;
    samples: number;
  } | null = null;
  private listeners: Array<(ev: GazeClickEvent) => void> = [];

  constructor(private cfg: DwellClickConfig) {}

  /** Feed in the resolved target for the latest frame (or null). */
  feed(targetId: string | null, frame: GazeFrame): void {
    const now = frame.t;
    const minConf = this.cfg.minConfidence ?? 0;
    const conf = frame.confidence ?? 1;
    const gap = this.cfg.maxFrameGapMs ?? 250;

    if (targetId === null || conf < minConf || frame.present === false) {
      this.current = null;
      return;
    }
    if (
      !this.current ||
      this.current.targetId !== targetId ||
      now - this.current.lastSeenAt > gap
    ) {
      this.current = { targetId, startedAt: now, lastSeenAt: now, confSum: conf, samples: 1 };
      return;
    }
    this.current.lastSeenAt = now;
    this.current.confSum += conf;
    this.current.samples++;

    const dwell = now - this.current.startedAt;
    if (dwell >= this.cfg.dwellMs) {
      const ev: GazeClickEvent = {
        targetId,
        dwellMs: dwell,
        confidence: this.current.confSum / this.current.samples,
        timestamp: now,
      };
      // Reset before firing so re-entrant listeners don't double-trigger.
      this.current = null;
      for (const l of this.listeners) l(ev);
    }
  }

  onClick(cb: (ev: GazeClickEvent) => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  reset(): void {
    this.current = null;
  }
}
