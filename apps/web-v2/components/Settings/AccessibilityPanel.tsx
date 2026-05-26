"use client";

/**
 * AccessibilityPanel — toggles for the learner-level inclusive-mode prefs.
 *
 * Persists to `learner_preferences.accessibility` via family-svc through
 * the `useAccessibilityPreferences` hook (which PATCHes
 * `/api/family/accessibility-preferences`).
 *
 * Each toggle is a labelled <input type="checkbox"> rendered as a switch
 * so keyboard + screen-reader UX is unambiguous.
 */
import { useCallback } from "react";
import {
  useAccessibilityPreferences,
  type AccessibilityPreferences,
} from "@aivo/learner-ui";

interface ToggleProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}

function Toggle({ id, label, description, checked, onChange, disabled }: ToggleProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        padding: "12px 0",
        borderBottom: "1px solid var(--lc-border, #e2e8f0)",
        alignItems: "flex-start",
      }}
    >
      <input
        id={id}
        type="checkbox"
        role="switch"
        aria-checked={checked}
        aria-describedby={`${id}-desc`}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 24, height: 24, marginTop: 4, cursor: "pointer" }}
      />
      <label htmlFor={id} style={{ flex: 1, cursor: "pointer" }}>
        <div style={{ fontWeight: 600, fontSize: 16 }}>{label}</div>
        <div id={`${id}-desc`} style={{ fontSize: 14, color: "var(--lc-fg-muted, #475569)" }}>
          {description}
        </div>
      </label>
    </div>
  );
}

const TOGGLES: Array<{
  key: keyof AccessibilityPreferences;
  label: string;
  description: string;
}> = [
  {
    key: "highContrast",
    label: "High contrast",
    description: "Use a black-and-white palette with AAA-tier contrast.",
  },
  {
    key: "dyslexiaFont",
    label: "Dyslexia-friendly font",
    description: "Switch the interface to OpenDyslexic.",
  },
  {
    key: "reducedMotion",
    label: "Reduce motion",
    description: "Disable animations and transitions in addition to the system setting.",
  },
  {
    key: "captionsByDefault",
    label: "Captions on by default",
    description: "Show captions automatically for video and audio lessons.",
  },
  {
    key: "readAloudAutoplay",
    label: "Read aloud automatically",
    description: "Start text-to-speech as soon as a lesson page loads.",
  },
  {
    key: "aacQuickAccess",
    label: "AAC quick access",
    description: "Show the AAC symbol board button in the global header.",
  },
  {
    key: "largerTouchTargets",
    label: "Larger touch targets",
    description: "Increase the minimum size of buttons and tap areas to 56 CSS px.",
  },
];

export interface AccessibilityPanelProps {
  /** Override the BFF endpoint (e.g. for tests). */
  endpoint?: string;
}

export function AccessibilityPanel({ endpoint }: AccessibilityPanelProps = {}): JSX.Element {
  const { preferences, loading, error, update } = useAccessibilityPreferences({ endpoint });

  const onToggle = useCallback(
    (key: keyof AccessibilityPreferences) => (next: boolean) => {
      update({ [key]: next } as Partial<AccessibilityPreferences>);
    },
    [update],
  );

  return (
    <section
      aria-labelledby="accessibility-panel-heading"
      style={{ maxWidth: 640, padding: 24 }}
    >
      <h2 id="accessibility-panel-heading" style={{ marginTop: 0 }}>
        Accessibility
      </h2>
      <p style={{ color: "var(--lc-fg-muted, #475569)" }}>
        These settings travel with the learner across web and mobile. Changes save
        automatically.
      </p>
      {error ? (
        <div role="alert" style={{ color: "var(--lc-danger, #b91c1c)", marginBottom: 12 }}>
          Couldn&rsquo;t save: {error}
        </div>
      ) : null}
      {loading ? (
        <div role="status" aria-live="polite">
          Loading your preferences&hellip;
        </div>
      ) : null}
      <div>
        {TOGGLES.map(({ key, label, description }) => (
          <Toggle
            key={key}
            id={`a11y-${key}`}
            label={label}
            description={description}
            checked={Boolean(preferences[key])}
            onChange={onToggle(key)}
            disabled={loading}
          />
        ))}
      </div>
    </section>
  );
}

export default AccessibilityPanel;
