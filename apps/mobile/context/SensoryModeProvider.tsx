// SensoryModeProvider — JS-only equivalent of the web app's
// `[data-sensory-mode]` CSS hook.
//
// React Native can't read CSS variables, so we expose the resolved
// per-mode palette from `@aivo/brand`'s `INCLUSIVE_WARM_BY_MODE`
// through context. Components call `useSensoryMode()` to read the
// active mode + its palette, or `useSensoryPalette()` as a shortcut.
//
// Persistence:
//   - AsyncStorage keeps the user's choice across launches (and
//     covers the signed-out / parent flows where there's no
//     learnerId to sync to).
//   - When a learnerId is provided, the resolved mode is synced to
//     assessment-svc's POST /api/assessments/sensory-profile endpoint
//     so the choice follows the learner across devices. On mount the
//     provider also GETs the current backend profile and reconciles
//     it with the locally-cached choice (backend wins if both exist
//     and differ — server is source of truth for learner data).
//
// Motion scaling:
//   - `motionScale` and `shadowStrength` are JS numbers — multiply
//     Animated/Reanimated durations and shadow opacities by these
//     values to honor calm / high-contrast.

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
import { INCLUSIVE_WARM_BY_MODE, resolveSensoryMode, type SensoryMode } from "@aivo/brand";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";

export type SensoryPalette = (typeof INCLUSIVE_WARM_BY_MODE)[SensoryMode];

interface SensoryModeContextValue {
  mode: SensoryMode;
  palette: SensoryPalette;
  motionScale: number;
  shadowStrength: number;
  setMode: (mode: SensoryMode) => Promise<void>;
  cycleMode: () => Promise<void>;
  isHydrated: boolean;
}

const STORAGE_KEY = "@aivo/sensory_mode_v1";

const defaultValue: SensoryModeContextValue = {
  mode: "standard",
  palette: INCLUSIVE_WARM_BY_MODE.standard,
  motionScale: INCLUSIVE_WARM_BY_MODE.standard.motionScale,
  shadowStrength: INCLUSIVE_WARM_BY_MODE.standard.shadowStrength,
  setMode: async () => {},
  cycleMode: async () => {},
  isHydrated: false,
};

const SensoryModeContext = createContext<SensoryModeContextValue>(defaultValue);

const MODE_ORDER: readonly SensoryMode[] = ["standard", "calm", "high-contrast"] as const;

interface ProviderProps {
  children: React.ReactNode;
  /** Optional learner id — when provided, mode changes also sync to
   *  the backend sensory profile. Safe to omit (auth screens, etc). */
  learnerId?: string | null;
}

export function SensoryModeProvider({ children, learnerId }: ProviderProps) {
  const [mode, setModeState] = useState<SensoryMode>("standard");
  const [isHydrated, setIsHydrated] = useState(false);
  // Tracks whether we've already fetched the backend profile for the
  // current learnerId — prevents the GET from re-firing on every
  // re-render and avoids racing with user-initiated setMode calls.
  const fetchedLearnerRef = useRef<string | null>(null);

  // Hydrate from AsyncStorage on mount.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled) return;
        if (raw) setModeState(resolveSensoryMode(raw));
      })
      .catch(() => {
        // Storage failures are non-fatal — fall back to standard.
      })
      .finally(() => {
        if (!cancelled) setIsHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // When a learnerId becomes available (after auth hydrates), fetch
  // the server-side profile and reconcile. The server is source of
  // truth for learner data — if it disagrees with the locally-cached
  // choice we adopt the server's value and update local cache.
  useEffect(() => {
    if (!learnerId) {
      fetchedLearnerRef.current = null;
      return;
    }
    if (fetchedLearnerRef.current === learnerId) return;
    fetchedLearnerRef.current = learnerId;

    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(
          API.ASSESSMENT,
          `/api/assessments/sensory-profile/${learnerId}`,
          { method: "GET" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { profile: null } | { mode?: string | null };
        if (cancelled) return;
        const remote = "mode" in data && data.mode ? resolveSensoryMode(data.mode) : null;
        if (remote) {
          setModeState(remote);
          await AsyncStorage.setItem(STORAGE_KEY, remote).catch(() => {});
        }
      } catch {
        // Offline / 5xx — keep the local choice, the provider stays
        // fully functional without backend connectivity.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [learnerId]);

  const syncToBackend = useCallback(
    async (next: SensoryMode) => {
      if (!learnerId) return;
      try {
        // POST /api/assessments/sensory-profile upserts on learnerId.
        // The route accepts a partial body, so we send only `mode` and
        // leave the per-channel sensitivities (visual/auditory/etc.)
        // untouched.
        await apiFetch(API.ASSESSMENT, "/api/assessments/sensory-profile", {
          method: "POST",
          body: JSON.stringify({ learnerId, mode: next }),
        });
      } catch {
        // Best-effort sync — the local choice is still honored even
        // if the backend round-trip fails (offline, 5xx, etc).
      }
    },
    [learnerId],
  );

  const setMode = useCallback(
    async (next: SensoryMode) => {
      const resolved = resolveSensoryMode(next);
      setModeState(resolved);
      try {
        await AsyncStorage.setItem(STORAGE_KEY, resolved);
      } catch {
        // ignore
      }
      void syncToBackend(resolved);
    },
    [syncToBackend],
  );

  const cycleMode = useCallback(async () => {
    const idx = MODE_ORDER.indexOf(mode);
    const next = MODE_ORDER[(idx + 1) % MODE_ORDER.length];
    await setMode(next);
  }, [mode, setMode]);

  const value = useMemo<SensoryModeContextValue>(() => {
    const palette = INCLUSIVE_WARM_BY_MODE[mode];
    return {
      mode,
      palette,
      motionScale: palette.motionScale,
      shadowStrength: palette.shadowStrength,
      setMode,
      cycleMode,
      isHydrated,
    };
  }, [mode, setMode, cycleMode, isHydrated]);

  return <SensoryModeContext.Provider value={value}>{children}</SensoryModeContext.Provider>;
}

/** Full sensory-mode context. */
export function useSensoryMode(): SensoryModeContextValue {
  return useContext(SensoryModeContext);
}

/** Shortcut for components that only need the resolved palette. */
export function useSensoryPalette(): SensoryPalette {
  return useContext(SensoryModeContext).palette;
}
