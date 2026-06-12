/**
 * Sprint 13 — characterization contract for the mobile surface renderer.
 *
 * The mobile vitest harness is node-environment, pure-logic by design (no
 * react-native rendering stack exists in this repo — see vitest.config.ts),
 * so the renderer is characterized at the source-contract level, the same
 * lockstep pattern as the tutor-art tests: every load-bearing behavior
 * marker of the monolith is asserted against the source set, and the SAME
 * assertions must hold against the decomposed registry + surface modules.
 *
 * Source resolution is dynamic: before the cut this reads
 * MobileSurfaceRenderer.tsx; after the cut it reads the dispatcher,
 * registry, and every surfaces/ module. The assertion list never changes —
 * that is the characterization guarantee.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const learningDir = resolve(here, "..", "src", "components", "learning");

const monolith = join(learningDir, "MobileSurfaceRenderer.tsx");

/** The dispatch layer: monolith pre-cut; dispatcher + registry post-cut. */
function dispatchSource(): string {
  if (existsSync(monolith)) return readFileSync(monolith, "utf8");
  return (
    readFileSync(join(learningDir, "surface-renderer.tsx"), "utf8") +
    readFileSync(join(learningDir, "surface-registry.ts"), "utf8")
  );
}

/** The full implementation: monolith pre-cut; dispatcher + registry + every surface module post-cut. */
function fullSource(): string {
  let src = dispatchSource();
  const surfacesDir = join(learningDir, "surfaces");
  if (existsSync(surfacesDir)) {
    for (const f of readdirSync(surfacesDir)) {
      if (/\.tsx?$/.test(f)) src += readFileSync(join(surfacesDir, f), "utf8");
    }
  }
  return src;
}

/** Surface-kind branch census, as found in the monolith (Sprint 13 read). */
const DISPATCHED_KINDS = [
  "text_response",
  "number_line",
  "fraction_bar",
  "coding_sandbox",
  "art_canvas",
  "reading_annotation",
  "voice_response",
  "graph",
  "drag_manipulative",
  "multi_step_workspace",
  "science_diagram",
  "geometry_workspace",
  "video",
  "audio",
  "music_sequencer",
  "scratchpad",
] as const;

/** Every SurfaceCommand payload variant the renderer can emit. */
const COMMAND_KINDS = [
  'kind: "text_response"',
  'kind: "number_line"',
  'kind: "fraction_bar"',
  'kind: "scratchpad"',
  'kind: "geometry_workspace"',
  'kind: "chart"',
  'kind: "coding_sandbox"',
  'kind: "art_canvas"',
  'kind: "reading_annotation"',
  'kind: "voice_response"',
  'kind: "graph"',
  'kind: "drag_manipulative"',
  'kind: "multi_step_workspace"',
  'kind: "science_diagram"',
  'kind: "media_complete"',
  'kind: "music_sequencer"',
  'kind: "noop"',
] as const;

/** Submit-control accessibility labels — the learner-facing contract. */
const A11Y_LABELS = [
  "submit annotation",
  "submit spoken answer",
  "submit graph",
  "submit placement",
  "submit steps",
  "submit diagram",
  "submit rhythm",
  "submit geometry work",
  "Your answer",
  "code editor",
] as const;

describe("mobile surface renderer — characterization contract", () => {
  it("dispatches every surface kind in the census", () => {
    const src = dispatchSource();
    for (const kind of DISPATCHED_KINDS) {
      expect(src, `dispatch layer must route "${kind}"`).toContain(`"${kind}"`);
    }
  });

  it("emits every SurfaceCommand variant", () => {
    const src = fullSource();
    for (const cmd of COMMAND_KINDS) {
      expect(src, `command payload ${cmd} must be emitted`).toContain(cmd);
    }
  });

  it("keeps the tutor entitlement map in sync with the web surface map", () => {
    const src = fullSource();
    expect(src).toMatch(/coding_sandbox:\s*"pixel"/);
    expect(src).toMatch(/art_canvas:\s*"muse"/);
    expect(src).toMatch(/music_sequencer:\s*"cadence"/);
    expect(src).toMatch(/voice_response:\s*\[\s*"echo",\s*"lingua"\s*\]/);
    // Locked-surface treatment copy (entitlement gate).
    expect(src).toContain("tutor add-on.");
    expect(src).toContain("Ask a grown-up to unlock it from the billing screen.");
  });

  it("keeps the explicit simplified-fallback treatment (no silent downgrade)", () => {
    const src = fullSource();
    expect(src).toContain(
      "This is a simplified version on your device — open it in the web app for the full",
    );
    expect(src).toContain('"unsupported_surface"');
    expect(src).toContain('"surface_started"');
    expect(src).toContain("no_dedicated_mobile_renderer");
  });

  it("keeps the Sprint 04 accommodations wired (read-aloud, captions, text scale, dyslexia face)", () => {
    const src = fullSource();
    expect(src).toContain("useLessonAccommodations");
    expect(src).toContain("accommodations.readAloud");
    expect(src).toContain("captionsAlwaysOn");
    expect(src).toContain("announce(");
    expect(src).toContain("bodyFontFamily");
    expect(src).toContain("scale(18)");
    expect(src).toContain("Caption: ");
  });

  it("keeps the submit-control accessibility labels", () => {
    const src = fullSource();
    for (const label of A11Y_LABELS) {
      expect(src, `a11y label "${label}" must survive`).toContain(label);
    }
  });

  it("keeps the hostile-config guards (tick clamp, fraction clamp, snapping)", () => {
    const src = fullSource();
    // number_line: at most 50 ticks regardless of config.
    expect(src).toMatch(/Math\.min\(50,/);
    // fraction_bar: denominator clamped to 1..12.
    expect(src).toMatch(/Math\.min\(12,/);
    // graph: tap coordinates snap into [min, max] on the step grid.
    expect(src).toContain("function snapTo(");
  });

  it("keeps media completion advancing the lesson (continue ack)", () => {
    const src = fullSource();
    expect(src).toContain('accessibilityLabel="continue"');
    expect(src).toContain("media_complete");
    // Audio cleanup on unmount must survive the move.
    expect(src).toContain("unloadAsync");
  });
});
