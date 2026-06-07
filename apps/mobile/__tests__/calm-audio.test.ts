/**
 * Calm audio cues — pure helpers + WAV synthesis (mobile port).
 *
 * Mirrors apps/web-v2/lib/learner/__tests__/calm-audio.test.ts for the pure
 * frequency/envelope contract, then pins the JS WAV synthesizer that replaces
 * the Web Audio API on React Native. Runs in the node vitest environment with
 * no native imports (the expo-av player lives in lib/calm-chime.ts).
 */
import { describe, expect, it } from "vitest";
import {
  CALM_PHASE_FREQUENCIES,
  CALM_ENVELOPE,
  CHIME_SAMPLE_RATE,
  frequencyForPhase,
  calmEnvelope,
  bytesToBase64,
  synthesizeChimeWavBytes,
  synthesizeChimeWavDataUri,
} from "../lib/calm-audio";
import { BOX_BREATH_PHASES, type BreathPhase } from "../lib/calm";

describe("frequencyForPhase", () => {
  it("is total over every breath phase", () => {
    for (const phase of BOX_BREATH_PHASES) {
      expect(typeof frequencyForPhase(phase)).toBe("number");
      expect(frequencyForPhase(phase)).toBeGreaterThan(0);
    }
  });

  it("assigns a distinct pitch to each phase", () => {
    const freqs = BOX_BREATH_PHASES.map((p: BreathPhase) => frequencyForPhase(p));
    expect(new Set(freqs).size).toBe(freqs.length);
  });

  it("keeps frequencies in a soft, audible range", () => {
    for (const hz of Object.values(CALM_PHASE_FREQUENCIES)) {
      expect(hz).toBeGreaterThanOrEqual(100);
      expect(hz).toBeLessThanOrEqual(2000);
    }
  });
});

describe("calmEnvelope", () => {
  it("has gentle, click-free, low-gain parameters", () => {
    const env = calmEnvelope();
    expect(env).toEqual(CALM_ENVELOPE);
    expect(env.attackSeconds).toBeGreaterThan(0);
    expect(env.attackSeconds).toBeLessThan(0.5);
    expect(env.releaseSeconds).toBeGreaterThan(0);
    expect(env.releaseSeconds).toBeLessThanOrEqual(2);
    expect(env.peakGain).toBeGreaterThan(0);
    expect(env.peakGain).toBeLessThanOrEqual(0.3);
  });
});

describe("bytesToBase64", () => {
  it("matches Buffer's base64 for representative byte lengths", () => {
    for (const len of [0, 1, 2, 3, 4, 5, 17, 64]) {
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i += 1) bytes[i] = (i * 37 + 11) & 0xff;
      expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
    }
  });
});

describe("synthesizeChimeWavBytes", () => {
  it("emits a valid 16-bit mono PCM WAV header per phase", () => {
    for (const phase of BOX_BREATH_PHASES) {
      const bytes = synthesizeChimeWavBytes(phase);
      const view = new DataView(bytes.buffer);
      const ascii = (off: number, n: number) =>
        String.fromCodePoint(...bytes.subarray(off, off + n));

      expect(ascii(0, 4)).toBe("RIFF");
      expect(ascii(8, 4)).toBe("WAVE");
      expect(ascii(12, 4)).toBe("fmt ");
      expect(ascii(36, 4)).toBe("data");

      expect(view.getUint16(20, true)).toBe(1); // PCM
      expect(view.getUint16(22, true)).toBe(1); // mono
      expect(view.getUint32(24, true)).toBe(CHIME_SAMPLE_RATE);
      expect(view.getUint16(34, true)).toBe(16); // bits/sample

      const dataSize = view.getUint32(40, true);
      expect(bytes.length).toBe(44 + dataSize);
      expect(view.getUint32(4, true)).toBe(36 + dataSize);
      expect(dataSize).toBeGreaterThan(0);
    }
  });

  it("renders distinct audio per phase", () => {
    const a = synthesizeChimeWavBytes("inhale");
    const b = synthesizeChimeWavBytes("exhale");
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });
});

describe("synthesizeChimeWavDataUri", () => {
  it("returns a base64 wav data URI for every phase", () => {
    for (const phase of BOX_BREATH_PHASES) {
      const uri = synthesizeChimeWavDataUri(phase);
      expect(uri.startsWith("data:audio/wav;base64,")).toBe(true);
      const b64 = uri.slice("data:audio/wav;base64,".length);
      expect(b64.length).toBeGreaterThan(0);
      // Round-trips back to the raw bytes.
      const decoded = Buffer.from(b64, "base64");
      expect(decoded.equals(Buffer.from(synthesizeChimeWavBytes(phase)))).toBe(true);
    }
  });
});
