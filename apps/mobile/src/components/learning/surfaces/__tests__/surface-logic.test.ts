/**
 * Sprint 13 — direct unit tests for the pure logic the decomposition made
 * exportable: entitlement, config readers, hostile-config guards, span
 * extraction, and the registry's fallback resolution.
 */
import { describe, expect, it, vi } from "vitest";
import { FULL_MOBILE_KINDS, isEntitled, requiredTutorsFor } from "../types";
import { createSurfaceStyles, readNumber, readString } from "../shared";
import { buildTicks } from "../NumberLineSurface";
import { snapTo } from "../GraphSurface";
import { readSpans } from "../ReadingAnnotationSurface";
import { SURFACE_REGISTRY, resolveSurface } from "../../surface-registry";
import { ScratchFallbackSurface } from "../ScratchFallbackSurface";
import { MediaSurface } from "../MediaSurface";
import type { LearnerSurfaceKind } from "@/src/types/learnerSurface";

// The mobile vitest harness is node-only; react-native and the expo native
// modules ship Flow/native code that node can't parse. These test-local
// mocks keep the module graph loadable — vitest hoists vi.mock above the
// imports. Every assertion below targets the PURE logic and identity
// wiring, not native rendering.
vi.mock("react-native", () => {
  const component = (name: string) => {
    const C = (_props: Record<string, unknown>) => null;
    C.displayName = name;
    return C;
  };
  return {
    View: component("View"),
    Text: component("Text"),
    TextInput: component("TextInput"),
    ScrollView: component("ScrollView"),
    Pressable: component("Pressable"),
    StyleSheet: { create: <T,>(s: T) => s },
    Platform: { OS: "ios", select: (o: Record<string, unknown>) => o.ios },
  };
});
vi.mock("react-native-svg", () => {
  const component = (name: string) => {
    const C = (_props: Record<string, unknown>) => null;
    C.displayName = name;
    return C;
  };
  return {
    default: component("Svg"),
    Svg: component("Svg"),
    Path: component("Path"),
    Circle: component("Circle"),
    Line: component("Line"),
    Polyline: component("Polyline"),
    Rect: component("Rect"),
  };
});
vi.mock("expo-av", () => ({
  Audio: { Sound: { createAsync: async () => ({ sound: {} }) } },
  Video: (_props: Record<string, unknown>) => null,
  ResizeMode: { CONTAIN: "contain" },
}));
vi.mock("expo-file-system/legacy", () => ({
  documentDirectory: "",
  EncodingType: { Base64: "base64" },
  readAsStringAsync: async () => "",
  deleteAsync: async () => undefined,
}));
// Seam mocks: these app modules pull deep native chains (expo-secure-store
// via the api client); the surfaces only call them, never at import time.
vi.mock("@/lib/surface-telemetry", () => ({ emitSurfaceTelemetry: vi.fn() }));
vi.mock("@/hooks/useSpeechInput", () => ({
  useSpeechInput: () => ({
    status: "idle" as const,
    transcript: "",
    error: null,
    isSupported: false,
    start: async () => undefined,
    stop: async () => undefined,
    reset: () => undefined,
  }),
}));

describe("tutor entitlement", () => {
  it("free surfaces require no tutor", () => {
    expect(requiredTutorsFor("text_response")).toEqual([]);
    expect(requiredTutorsFor("number_line")).toEqual([]);
  });

  it("premium surfaces map to their tutors (web parity)", () => {
    expect(requiredTutorsFor("coding_sandbox")).toEqual(["pixel"]);
    expect(requiredTutorsFor("art_canvas")).toEqual(["muse"]);
    expect(requiredTutorsFor("music_sequencer")).toEqual(["cadence"]);
    expect(requiredTutorsFor("voice_response")).toEqual(["echo", "lingua"]);
  });

  it("isEntitled: default-allow while entitlements load; set and array forms gate", () => {
    expect(isEntitled("coding_sandbox", undefined)).toBe(true);
    expect(isEntitled("coding_sandbox", new Set(["pixel"]))).toBe(true);
    expect(isEntitled("coding_sandbox", new Set(["muse"]))).toBe(false);
    expect(isEntitled("voice_response", ["lingua"])).toBe(true);
    expect(isEntitled("voice_response", [])).toBe(false);
    expect(isEntitled("text_response", [])).toBe(true); // free regardless
  });
});

describe("shared surface styles", () => {
  const theme = {
    colors: {
      text: "#101010",
      surface: "#ffffff",
      primary: "#3b5bfd",
      primarySoft: "#dde4ff",
      border: "#d4d4d8",
      textSoft: "#6b7280",
    },
  } as Parameters<typeof createSurfaceStyles>[0];

  it("keeps the touch-target and affordance constants", () => {
    const styles = createSurfaceStyles(theme);
    // 44pt minimum touch target on number-line ticks (WCAG 2.5.5 floor).
    expect(styles.tick.minWidth).toBe(44);
    // Disabled submit is visually distinct but still legible.
    expect(styles.submitDisabled.opacity).toBe(0.4);
    // Ink workspace keeps its fixed drawing height.
    expect(styles.scratchHolder.height).toBe(260);
    // Code editor gives enough room to actually write code.
    expect(styles.codeInput.minHeight).toBe(200);
    expect(styles.textInput.minHeight).toBe(96);
  });

  it("derives every themed color from the tier theme", () => {
    const styles = createSurfaceStyles(theme);
    expect(styles.submit.backgroundColor).toBe(theme.colors.primary);
    expect(styles.submitText.color).toBe(theme.colors.surface);
    expect(styles.title.color).toBe(theme.colors.text);
    expect(styles.fractionSegmentShaded.backgroundColor).toBe(theme.colors.primary);
    expect(styles.tickSelected.backgroundColor).toBe(theme.colors.primary);
  });
});

describe("config readers", () => {
  it("readNumber takes finite numbers and falls back otherwise", () => {
    expect(readNumber({ n: 5 }, "n", 1)).toBe(5);
    expect(readNumber({ n: Number.NaN }, "n", 1)).toBe(1);
    expect(readNumber({ n: "5" }, "n", 1)).toBe(1);
    expect(readNumber(undefined, "n", 7)).toBe(7);
  });

  it("readString takes strings and falls back otherwise", () => {
    expect(readString({ s: "hi" }, "s", "x")).toBe("hi");
    expect(readString({ s: 5 }, "s", "x")).toBe("x");
    expect(readString(undefined, "s", "x")).toBe("x");
  });
});

describe("hostile-config guards", () => {
  it("buildTicks clamps to 50 ticks and degrades to [min] when max<=min", () => {
    expect(buildTicks(0, 10_000, 1)).toHaveLength(50);
    expect(buildTicks(0, 10, 1)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(buildTicks(5, 5, 1)).toEqual([5]);
    expect(buildTicks(5, 2, 1)).toEqual([5]);
    expect(buildTicks(0, 4, 0)).toEqual([0, 1, 2, 3, 4]); // step<=0 → 1
  });

  it("snapTo snaps to the step grid and clamps into bounds", () => {
    expect(snapTo(3.4, 0, 10, 1)).toBe(3);
    expect(snapTo(3.6, 0, 10, 1)).toBe(4);
    expect(snapTo(-2, 0, 10, 1)).toBe(0);
    expect(snapTo(14, 0, 10, 1)).toBe(10);
    expect(snapTo(7, 0, 10, 5)).toBe(5);
  });
});

describe("reading span extraction", () => {
  it("filters malformed entries and coerces text", () => {
    const spans = readSpans({
      passage: [
        { id: "a", text: "The fox" },
        { id: "b" },
        { text: "no id" },
        null,
        "junk",
        { id: "c", text: 42, breakAfter: true },
      ],
    });
    expect(spans).toEqual([
      { id: "a", text: "The fox", selectable: undefined, breakAfter: undefined },
      { id: "b", text: "", selectable: undefined, breakAfter: undefined },
      { id: "c", text: "42", selectable: undefined, breakAfter: true },
    ]);
  });

  it("returns [] when passage is missing or not an array", () => {
    expect(readSpans(undefined)).toEqual([]);
    expect(readSpans({ passage: "nope" })).toEqual([]);
  });
});

describe("surface registry", () => {
  it("routes every census kind to a dedicated module", () => {
    const kinds: LearnerSurfaceKind[] = [
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
      "music_sequencer",
      "geometry_workspace",
      "video",
      "audio",
      "scratchpad",
    ];
    for (const kind of kinds) {
      expect(SURFACE_REGISTRY[kind], `registry must route ${kind}`).toBeTruthy();
      expect(resolveSurface(kind)).toBe(SURFACE_REGISTRY[kind]);
    }
    expect(FULL_MOBILE_KINDS.size).toBe(16);
  });

  it("video and audio share the media module", () => {
    expect(resolveSurface("video")).toBe(MediaSurface);
    expect(resolveSurface("audio")).toBe(MediaSurface);
  });

  it("falls back to the ink workspace for chart and unknown kinds", () => {
    expect(resolveSurface("chart")).toBe(ScratchFallbackSurface);
    expect(resolveSurface("definitely_new_kind" as LearnerSurfaceKind)).toBe(
      ScratchFallbackSurface,
    );
    // chart is intentionally NOT a full mobile kind — the dispatcher labels
    // it as the simplified experience.
    expect(FULL_MOBILE_KINDS.has("chart" as LearnerSurfaceKind)).toBe(false);
    expect(FULL_MOBILE_KINDS.has("scratchpad")).toBe(true);
  });
});
