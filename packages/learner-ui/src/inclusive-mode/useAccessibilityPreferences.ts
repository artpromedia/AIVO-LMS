/**
 * useAccessibilityPreferences — reads the learner's accessibility settings
 * from `/api/family/accessibility-preferences` (proxied by the BFF on web,
 * called directly from mobile). Exposes a typed shape + an updater that
 * PATCHes back to the same endpoint.
 *
 * The hook is intentionally fetch-based (no SDK) so it can be reused by
 * either Next.js or React Native without a transport dependency.
 */
import { useCallback, useEffect, useState } from "react";

export interface AccessibilityPreferences {
  highContrast: boolean;
  dyslexiaFont: boolean;
  reducedMotion: boolean;
  captionsByDefault: boolean;
  readAloudAutoplay: boolean;
  aacQuickAccess: boolean;
  largerTouchTargets: boolean;
  /** Free-form locale override; falls back to the session locale when unset. */
  preferredLocale?: string;
}

export const DEFAULT_ACCESSIBILITY_PREFERENCES: AccessibilityPreferences = {
  highContrast: false,
  dyslexiaFont: false,
  reducedMotion: false,
  captionsByDefault: true,
  readAloudAutoplay: false,
  aacQuickAccess: false,
  largerTouchTargets: false,
};

export interface UseAccessibilityPreferencesOptions {
  /** Override the endpoint (e.g. for unit tests). */
  endpoint?: string;
  /** Skip the initial fetch (use the defaults). */
  skipFetch?: boolean;
}

export interface UseAccessibilityPreferencesResult {
  preferences: AccessibilityPreferences;
  loading: boolean;
  error: string | null;
  update: (patch: Partial<AccessibilityPreferences>) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useAccessibilityPreferences(
  options: UseAccessibilityPreferencesOptions = {},
): UseAccessibilityPreferencesResult {
  const endpoint = options.endpoint ?? "/api/family/accessibility-preferences";
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(
    DEFAULT_ACCESSIBILITY_PREFERENCES,
  );
  const [loading, setLoading] = useState(!options.skipFetch);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as
        | AccessibilityPreferences
        | { data?: AccessibilityPreferences; preferences?: AccessibilityPreferences };
      const payload =
        "data" in json && json.data
          ? json.data
          : "preferences" in json && json.preferences
            ? json.preferences
            : (json as AccessibilityPreferences);
      setPreferences({ ...DEFAULT_ACCESSIBILITY_PREFERENCES, ...payload });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  const update = useCallback(
    async (patch: Partial<AccessibilityPreferences>) => {
      // Optimistic update so toggles feel instant.
      const next = { ...preferences, ...patch };
      setPreferences(next);
      try {
        const res = await fetch(endpoint, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (e) {
        setError((e as Error).message);
        // Re-fetch on failure so the UI doesn't claim a state the server
        // doesn't have.
        await refresh();
      }
    },
    [endpoint, preferences, refresh],
  );

  useEffect(() => {
    if (options.skipFetch) return;
    refresh();
  }, [refresh, options.skipFetch]);

  return { preferences, loading, error, update, refresh };
}

export default useAccessibilityPreferences;
