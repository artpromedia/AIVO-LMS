/**
 * Learner preferences provider — accessibility + audio.
 *
 * Persists to AsyncStorage (per-device, matching web's per-browser
 * accessibility storage) and exposes typed read/update hooks. Mounted
 * once near the root, alongside `SensoryModeProvider` (which owns the
 * sensory-mode choice and its backend sync).
 *
 * Pure types + sanitisation live in `./preferences-logic` so they stay
 * node-testable; this module only adds React state + storage.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  type A11yPreferences,
  type AudioPreferences,
  DEFAULT_A11Y,
  DEFAULT_AUDIO,
  TEXT_SCALE_FACTOR,
  coerceA11y,
  coerceAudio,
  scaleFont,
} from "./preferences-logic";

const A11Y_KEY = "@aivo/a11y_prefs_v1";
const AUDIO_KEY = "@aivo/audio_prefs_v1";

interface PreferencesContextValue {
  a11y: A11yPreferences;
  audio: AudioPreferences;
  setA11y: (patch: Partial<A11yPreferences>) => void;
  setAudio: (patch: Partial<AudioPreferences>) => void;
  /** Multiplier for the active text scale (small 0.9 / medium 1 / large 1.15). */
  textScaleFactor: number;
  /** Scale a base font size by the active text scale. */
  scale: (size: number) => number;
  isHydrated: boolean;
}

const defaultValue: PreferencesContextValue = {
  a11y: DEFAULT_A11Y,
  audio: DEFAULT_AUDIO,
  setA11y: () => {},
  setAudio: () => {},
  textScaleFactor: 1,
  scale: (s) => s,
  isHydrated: false,
};

const PreferencesContext = createContext<PreferencesContextValue>(defaultValue);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [a11y, setA11yState] = useState<A11yPreferences>(DEFAULT_A11Y);
  const [audio, setAudioState] = useState<AudioPreferences>(DEFAULT_AUDIO);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate both preference groups on mount.
  useEffect(() => {
    let cancelled = false;
    Promise.all([AsyncStorage.getItem(A11Y_KEY), AsyncStorage.getItem(AUDIO_KEY)])
      .then(([rawA11y, rawAudio]) => {
        if (cancelled) return;
        if (rawA11y) setA11yState(coerceA11y(safeParse(rawA11y)));
        if (rawAudio) setAudioState(coerceAudio(safeParse(rawAudio)));
      })
      .catch(() => {
        // Storage failure is non-fatal — defaults apply.
      })
      .finally(() => {
        if (!cancelled) setIsHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setA11y = useCallback((patch: Partial<A11yPreferences>) => {
    setA11yState((prev) => {
      const next = coerceA11y({ ...prev, ...patch });
      void AsyncStorage.setItem(A11Y_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const setAudio = useCallback((patch: Partial<AudioPreferences>) => {
    setAudioState((prev) => {
      const next = coerceAudio({ ...prev, ...patch });
      void AsyncStorage.setItem(AUDIO_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<PreferencesContextValue>(() => {
    const textScaleFactor = TEXT_SCALE_FACTOR[a11y.textScale];
    return {
      a11y,
      audio,
      setA11y,
      setAudio,
      textScaleFactor,
      scale: (size: number) => scaleFont(size, a11y.textScale),
      isHydrated,
    };
  }, [a11y, audio, setA11y, setAudio, isHydrated]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Full preferences context (accessibility + audio). */
export function usePreferences(): PreferencesContextValue {
  return useContext(PreferencesContext);
}

/** Accessibility-only slice. */
export function useA11yPreferences() {
  const { a11y, setA11y, textScaleFactor, scale, isHydrated } = usePreferences();
  return { prefs: a11y, setPref: setA11y, textScaleFactor, scale, isHydrated };
}

/** Audio-only slice. */
export function useAudioPreferences() {
  const { audio, setAudio, isHydrated } = usePreferences();
  return { prefs: audio, setPref: setAudio, isHydrated };
}
