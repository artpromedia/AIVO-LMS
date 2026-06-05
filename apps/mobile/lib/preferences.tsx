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
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AccessibilityProfile } from "@aivo/accessibility-contract";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";
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
import { a11yToProfile, profileToA11yPatch } from "./accessibility-sync";

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

interface PreferencesProviderProps {
  children: React.ReactNode;
  /** Optional learner id — when provided, accessibility prefs sync to the
   *  backend (assessment-svc) so they follow the learner across devices.
   *  Safe to omit (auth / parent flows with no learner). */
  learnerId?: string | null;
}

export function PreferencesProvider({ children, learnerId }: PreferencesProviderProps) {
  const [a11y, setA11yState] = useState<A11yPreferences>(DEFAULT_A11Y);
  const [audio, setAudioState] = useState<AudioPreferences>(DEFAULT_AUDIO);
  const [isHydrated, setIsHydrated] = useState(false);
  // Mirror of the latest a11y for use inside effects without re-subscribing.
  const a11yRef = useRef(a11y);
  useEffect(() => {
    a11yRef.current = a11y;
  }, [a11y]);
  // Tracks the learner we've already reconciled, so the GET fires once per
  // learner rather than on every render.
  const reconciledLearnerRef = useRef<string | null>(null);

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

  // Apply a patch locally (state + AsyncStorage) WITHOUT a backend round-trip.
  // Used by the reconcile path so adopting the server's values doesn't echo
  // straight back to the server.
  const applyA11yLocal = useCallback((patch: Partial<A11yPreferences>) => {
    setA11yState((prev) => {
      const next = coerceA11y({ ...prev, ...patch });
      void AsyncStorage.setItem(A11Y_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  // Best-effort upload of the canonical profile (mirrors SensoryModeProvider).
  const syncA11yToBackend = useCallback(
    async (next: A11yPreferences) => {
      if (!learnerId) return;
      try {
        await apiFetch(API.ASSESSMENT, "/api/assessments/accessibility-preferences", {
          method: "POST",
          body: JSON.stringify({ learnerId, ...a11yToProfile(next) }),
        });
      } catch {
        // Offline / 5xx — the local choice is still honored.
      }
    },
    [learnerId],
  );

  // On sign-in, fetch the server profile and reconcile (server wins for the
  // shared fields). Keeps the local cache, so the app works offline.
  useEffect(() => {
    if (!learnerId) {
      reconciledLearnerRef.current = null;
      return;
    }
    if (reconciledLearnerRef.current === learnerId) return;
    reconciledLearnerRef.current = learnerId;

    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(
          API.ASSESSMENT,
          `/api/assessments/accessibility-preferences/${learnerId}`,
          { method: "GET" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { prefs: Partial<AccessibilityProfile> | null };
        if (cancelled || !data?.prefs) return;
        const patch = profileToA11yPatch(data.prefs, a11yRef.current);
        if (Object.keys(patch).length > 0) applyA11yLocal(patch);
      } catch {
        // Offline / 5xx — keep the local choice.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [learnerId, applyA11yLocal]);

  const setA11y = useCallback(
    (patch: Partial<A11yPreferences>) => {
      setA11yState((prev) => {
        const next = coerceA11y({ ...prev, ...patch });
        void AsyncStorage.setItem(A11Y_KEY, JSON.stringify(next)).catch(() => {});
        void syncA11yToBackend(next);
        return next;
      });
    },
    [syncA11yToBackend],
  );

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
