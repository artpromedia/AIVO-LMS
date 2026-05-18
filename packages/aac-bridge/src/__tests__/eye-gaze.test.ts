/**
 * Eye-gaze pipeline tests — calibration accuracy + offset, target mapper
 * (hit-test + nearest-centre fallback), dwell-click thresholding + gap
 * reset, end-to-end TobiiAdapter integration via attachEyeGazePipeline().
 */
import { describe, it, expect, beforeEach } from "vitest";
import { CalibrationState, GazeTargetMapper, DwellClickController } from "../eye-gaze/pipeline.js";
import { TobiiAdapter } from "../adapters/TobiiAdapter.js";

describe("CalibrationState", () => {
  it("computes accuracy near 1 when measured ≈ target", () => {
    const c = new CalibrationState();
    c.beginPoint(0, 100, 100);
    for (let i = 0; i < 30; i++) c.acceptSample({ x: 100 + (i % 3), y: 100, t: i });
    c.endPoint();
    c.beginPoint(1, 500, 300);
    for (let i = 0; i < 30; i++) c.acceptSample({ x: 500, y: 300 + (i % 2), t: i });
    c.endPoint();
    expect(c.accuracy(1024, 768)).toBeGreaterThan(0.99);
  });

  it("global offset corrects for systematic bias", () => {
    const c = new CalibrationState();
    // Learner consistently looks 30px to the right of the target.
    for (let p = 0; p < 5; p++) {
      c.beginPoint(p, 100 * p, 100 * p);
      for (let i = 0; i < 10; i++) c.acceptSample({ x: 100 * p + 30, y: 100 * p, t: i });
      c.endPoint();
    }
    expect(c.globalOffset().dx).toBeCloseTo(-30, 0);
    expect(c.globalOffset().dy).toBeCloseTo(0, 0);
  });

  it("returns 0 accuracy with no points", () => {
    expect(new CalibrationState().accuracy(1024, 768)).toBe(0);
  });

  it("ignores frames marked present=false", () => {
    const c = new CalibrationState();
    c.beginPoint(0, 100, 100);
    c.acceptSample({ x: 999, y: 999, t: 0, present: false });
    c.acceptSample({ x: 100, y: 100, t: 1 });
    const point = c.endPoint();
    expect(point?.measuredX).toBe(100);
    expect(point?.samples).toBe(1);
  });
});

describe("GazeTargetMapper", () => {
  let m: GazeTargetMapper;
  beforeEach(() => {
    m = new GazeTargetMapper();
    m.setTargets([
      { id: "btn-yes", x: 0, y: 0, width: 100, height: 50 },
      { id: "btn-no", x: 200, y: 0, width: 100, height: 50 },
    ]);
  });

  it("returns the target whose rect contains the corrected gaze point", () => {
    expect(m.resolve({ x: 50, y: 25, t: 0 })).toBe("btn-yes");
    expect(m.resolve({ x: 250, y: 25, t: 0 })).toBe("btn-no");
  });

  it("falls back to nearest centre within pickRadiusPx", () => {
    // btn-yes centre is (50, 25). Point (110, 25) is 60px away — within
    // an 80px pickRadiusPx but outside its rect.
    expect(m.resolve({ x: 110, y: 25, t: 0 }, 80)).toBe("btn-yes");
    expect(m.resolve({ x: 999, y: 999, t: 0 }, 80)).toBeNull();
  });

  it("applies the calibration offset before hit-testing", () => {
    m.setCalibrationOffset({ dx: -50, dy: 0 });
    // Raw gaze at x=100 → corrected x=50 → inside btn-yes.
    expect(m.resolve({ x: 100, y: 25, t: 0 })).toBe("btn-yes");
  });
});

describe("DwellClickController", () => {
  it("emits click after continuous dwell ≥ dwellMs", () => {
    const d = new DwellClickController({ dwellMs: 800, maxFrameGapMs: 1000 });
    const seen: string[] = [];
    d.onClick((e) => seen.push(e.targetId));
    d.feed("a", { x: 0, y: 0, t: 0 });
    d.feed("a", { x: 0, y: 0, t: 400 });
    d.feed("a", { x: 0, y: 0, t: 900 }); // crosses threshold
    expect(seen).toEqual(["a"]);
  });

  it("resets on target switch", () => {
    const d = new DwellClickController({ dwellMs: 800, maxFrameGapMs: 1000 });
    const seen: string[] = [];
    d.onClick((e) => seen.push(e.targetId));
    d.feed("a", { x: 0, y: 0, t: 0 });
    d.feed("a", { x: 0, y: 0, t: 700 });
    d.feed("b", { x: 0, y: 0, t: 800 });
    d.feed("b", { x: 0, y: 0, t: 900 }); // only 100ms on b
    expect(seen.length).toBe(0);
  });

  it("resets when frame gap exceeds maxFrameGapMs (long blink)", () => {
    const d = new DwellClickController({ dwellMs: 800, maxFrameGapMs: 250 });
    const seen: string[] = [];
    d.onClick((e) => seen.push(e.targetId));
    d.feed("a", { x: 0, y: 0, t: 0 });
    d.feed("a", { x: 0, y: 0, t: 500 });
    // 600ms gap → reset.
    d.feed("a", { x: 0, y: 0, t: 1100 });
    d.feed("a", { x: 0, y: 0, t: 1500 });
    expect(seen.length).toBe(0);
  });

  it("filters frames below minConfidence", () => {
    const d = new DwellClickController({ dwellMs: 100, minConfidence: 0.5 });
    const seen: string[] = [];
    d.onClick((e) => seen.push(e.targetId));
    d.feed("a", { x: 0, y: 0, t: 0, confidence: 0.1 });
    d.feed("a", { x: 0, y: 0, t: 200, confidence: 0.2 });
    expect(seen.length).toBe(0);
  });
});

describe("TobiiAdapter.attachEyeGazePipeline", () => {
  it("emits an AAC eye_gaze event when dwell on a registered target completes", () => {
    const a = new TobiiAdapter();
    const { mapper } = a.attachEyeGazePipeline({
      targets: [{ id: "go", x: 0, y: 0, width: 100, height: 100 }],
      dwellMs: 200,
    });
    const events: string[] = [];
    a.onEvent((e) => events.push(`${e.method}:${e.targetId}`));
    a.ingestGazeFrame({ x: 50, y: 50, t: 0 });
    a.ingestGazeFrame({ x: 50, y: 50, t: 100 });
    a.ingestGazeFrame({ x: 50, y: 50, t: 250 });
    expect(events).toEqual(["eye_gaze:go"]);
    // Validate mapper still resolves after the click — we should be able to
    // dwell again on the same target.
    expect(mapper.resolve({ x: 50, y: 50, t: 0 })).toBe("go");
    a.dispose();
  });

  it("detachEyeGazePipeline tears the pipeline down cleanly", () => {
    const a = new TobiiAdapter();
    a.attachEyeGazePipeline({ targets: [{ id: "go", x: 0, y: 0, width: 10, height: 10 }] });
    a.detachEyeGazePipeline();
    const events: string[] = [];
    a.onEvent((e) => events.push(e.targetId));
    a.ingestGazeFrame({ x: 5, y: 5, t: 0 });
    a.ingestGazeFrame({ x: 5, y: 5, t: 1000 });
    expect(events.length).toBe(0);
    a.dispose();
  });
});
