/**
 * Calm Corner — native chime player (mobile).
 *
 * Mirrors the web `createCalmChime()` contract (phaseCue / dispose) but
 * plays the pure WAV synthesized in lib/calm-audio via expo-av instead of
 * the Web Audio API. One short, soft tone per breath-phase transition; no
 * autoplay (a cue only sounds because the learner started/advanced the
 * activity). Every method is guarded so a missing/blocked audio device is a
 * silent no-op rather than a thrown error.
 */
import { Audio } from "expo-av";
import type { BreathPhase } from "@/lib/calm";
import { synthesizeChimeWavDataUri } from "@/lib/calm-audio";

export interface CalmChime {
  phaseCue(phase: BreathPhase): void;
  dispose(): void;
}

/** Pre-rendered once per phase — the tone never changes for a given phase. */
function buildPhaseUris(): Record<BreathPhase, string> {
  return {
    inhale: synthesizeChimeWavDataUri("inhale"),
    hold_in: synthesizeChimeWavDataUri("hold_in"),
    exhale: synthesizeChimeWavDataUri("exhale"),
    hold_out: synthesizeChimeWavDataUri("hold_out"),
  };
}

export function createCalmChime(): CalmChime {
  let disposed = false;
  const uris = buildPhaseUris();
  // Track the in-flight sound so a cue replaces (never stacks on) the last.
  let current: Audio.Sound | null = null;

  async function playPhase(phase: BreathPhase): Promise<void> {
    if (disposed) return;
    try {
      if (current) {
        const prev = current;
        current = null;
        await prev.unloadAsync().catch(() => undefined);
      }
      if (disposed) return;
      const { sound } = await Audio.Sound.createAsync(
        { uri: uris[phase] },
        { shouldPlay: true, volume: 0.6 },
      );
      if (disposed) {
        await sound.unloadAsync().catch(() => undefined);
        return;
      }
      current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => undefined);
          if (current === sound) current = null;
        }
      });
    } catch {
      /* no audio device / blocked — stay silent */
    }
  }

  return {
    phaseCue(phase: BreathPhase): void {
      void playPhase(phase);
    },
    dispose(): void {
      disposed = true;
      const sound = current;
      current = null;
      if (sound) void sound.unloadAsync().catch(() => undefined);
    },
  };
}
