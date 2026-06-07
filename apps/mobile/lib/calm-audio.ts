/**
 * Calm Corner — synthesized, dependency-free audio cues (mobile port).
 *
 * The web build (apps/web-v2/lib/learner/calm-audio.ts) synthesizes soft
 * sine "chimes" with the Web Audio API. React Native has no Web Audio API,
 * so this module keeps the same pure, testable contract — per-phase
 * frequencies and a gentle attack/release envelope — and adds a pure WAV
 * synthesizer (`synthesizeChimeWavDataUri`) that renders a short, soft tone
 * entirely in JS. The native player (`createCalmChime`) lives in
 * lib/calm-chime.ts and feeds that data URI to expo-av, so this file ships
 * no native imports and runs unchanged under the node test environment.
 */

import type { BreathPhase } from "@/lib/calm";

/** Distinct, soft pitches per phase (Hz). Total over the BreathPhase union. */
export const CALM_PHASE_FREQUENCIES: Record<BreathPhase, number> = {
  inhale: 396,
  hold_in: 528,
  exhale: 432,
  hold_out: 480,
};

export function frequencyForPhase(phase: BreathPhase): number {
  return CALM_PHASE_FREQUENCIES[phase];
}

/** Gentle attack/release envelope — no clicks, low peak gain. */
export interface ChimeEnvelope {
  /** Seconds to ramp from silence to peak. */
  attackSeconds: number;
  /** Seconds to ramp from peak back to silence. */
  releaseSeconds: number;
  /** Peak gain (0..1); kept low so cues are soft. */
  peakGain: number;
}

export const CALM_ENVELOPE: ChimeEnvelope = {
  attackSeconds: 0.05,
  releaseSeconds: 0.55,
  peakGain: 0.12,
};

export function calmEnvelope(): ChimeEnvelope {
  return CALM_ENVELOPE;
}

/** Sample rate for the rendered chime — low enough to keep the data URI
 *  small, high enough to render the soft pitches cleanly. */
export const CHIME_SAMPLE_RATE = 22_050;

/** Linear attack then linear release, matching the web envelope shape. */
function envelopeGainAt(sampleIndex: number, attackSamples: number, totalSamples: number): number {
  if (sampleIndex < attackSamples) {
    return attackSamples === 0 ? 1 : sampleIndex / attackSamples;
  }
  const releaseSamples = Math.max(1, totalSamples - attackSamples);
  const released = (sampleIndex - attackSamples) / releaseSamples;
  return Math.max(0, 1 - released);
}

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Minimal, portable base64 encoder (no Buffer/btoa dependency). */
export function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (b0 << 16) | (b1 << 8) | b2;
    out += BASE64_ALPHABET[(triple >> 18) & 0x3f];
    out += BASE64_ALPHABET[(triple >> 12) & 0x3f];
    out += i + 1 < bytes.length ? BASE64_ALPHABET[(triple >> 6) & 0x3f] : "=";
    out += i + 2 < bytes.length ? BASE64_ALPHABET[triple & 0x3f] : "=";
  }
  return out;
}

/**
 * Render a soft sine chime for `phase` as a 16-bit mono PCM WAV and return
 * the raw bytes. Pure and deterministic, so it is fully unit-testable.
 */
export function synthesizeChimeWavBytes(phase: BreathPhase): Uint8Array {
  const env = calmEnvelope();
  const sampleRate = CHIME_SAMPLE_RATE;
  const durationSeconds = env.attackSeconds + env.releaseSeconds;
  const totalSamples = Math.max(1, Math.floor(sampleRate * durationSeconds));
  const attackSamples = Math.floor(sampleRate * env.attackSeconds);
  const freq = frequencyForPhase(phase);
  const bytesPerSample = 2;
  const dataSize = totalSamples * bytesPerSample;
  const buffer = new Uint8Array(44 + dataSize);
  const view = new DataView(buffer.buffer);

  // RIFF/WAVE header.
  writeAscii(buffer, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(buffer, 8, "WAVE");
  writeAscii(buffer, 12, "fmt ");
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true); // byte rate
  view.setUint16(32, bytesPerSample, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(buffer, 36, "data");
  view.setUint32(40, dataSize, true);

  const twoPiF = 2 * Math.PI * freq;
  for (let i = 0; i < totalSamples; i += 1) {
    const t = i / sampleRate;
    const gain = envelopeGainAt(i, attackSamples, totalSamples) * env.peakGain;
    const sample = Math.sin(twoPiF * t) * gain;
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + i * bytesPerSample, Math.round(clamped * 32767), true);
  }
  return buffer;
}

function writeAscii(buffer: Uint8Array, offset: number, text: string): void {
  for (let i = 0; i < text.length; i += 1) {
    buffer[offset + i] = text.charCodeAt(i);
  }
}

/** The synthesized chime as a `data:audio/wav;base64,…` URI for expo-av. */
export function synthesizeChimeWavDataUri(phase: BreathPhase): string {
  return `data:audio/wav;base64,${bytesToBase64(synthesizeChimeWavBytes(phase))}`;
}
