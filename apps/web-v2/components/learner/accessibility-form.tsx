"use client";

/**
 * Sprint 15: Shared client form for editing accessibility preferences.
 * Used by both the parent-side learner accessibility page and the learner's
 * own settings page. All writes go through the BFF so audit + validation
 * happen server-side.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { AccessibilityPreferences } from "@/lib/db/types";

type ToggleKey = Extract<
  keyof Omit<AccessibilityPreferences, "learnerId" | "tenantId" | "updatedAt">,
  | "readAloud"
  | "largeText"
  | "dyslexiaFriendlyFont"
  | "highContrast"
  | "captionsAlwaysOn"
  | "reducedMotion"
  | "hapticsEnabled"
  | "calmAudioCues"
  | "shorterSteps"
  | "extraHints"
  | "visualSupports"
  | "breakReminders"
  | "audioFirst"
  | "keyboardOptimized"
  | "aacEnabled"
>;

const TOGGLES: Array<{
  key: ToggleKey;
  label: string;
  help: string;
  group: "reading" | "motion" | "support" | "aac";
}> = [
  {
    key: "readAloud",
    label: "Read aloud",
    help: "Announces lesson text for screen readers and assistive tools.",
    group: "reading",
  },
  {
    key: "largeText",
    label: "Larger text",
    help: "Bigger type and looser line spacing.",
    group: "reading",
  },
  {
    key: "dyslexiaFriendlyFont",
    label: "Dyslexia-friendly font",
    help: "Switches the lesson font to a wider, evenly-spaced face.",
    group: "reading",
  },
  {
    key: "highContrast",
    label: "High contrast",
    help: "Higher contrast colors for better visibility.",
    group: "reading",
  },
  {
    key: "captionsAlwaysOn",
    label: "Captions on",
    help: "Show captions whenever the tutor speaks.",
    group: "reading",
  },
  {
    key: "reducedMotion",
    label: "Reduce motion",
    help: "Skips background animation and transitions.",
    group: "motion",
  },
  {
    key: "hapticsEnabled",
    label: "Haptic feedback",
    help: "Small vibration on mobile when a choice is selected.",
    group: "motion",
  },
  {
    key: "calmAudioCues",
    label: "Calm sounds",
    help: "Soft audio cue on each breathing phase in the Calm Corner. Off by default.",
    group: "motion",
  },
  {
    key: "shorterSteps",
    label: "Shorter steps",
    help: "Trims the lesson to the essentials.",
    group: "support",
  },
  {
    key: "extraHints",
    label: "Extra hints",
    help: "More guidance during practice.",
    group: "support",
  },
  {
    key: "visualSupports",
    label: "Visual supports",
    help: "Add icons and diagrams where helpful.",
    group: "support",
  },
  {
    key: "breakReminders",
    label: "Break reminders",
    help: "Gentle prompts to take a break.",
    group: "support",
  },
  {
    key: "audioFirst",
    label: "Audio first",
    help: "Lead with audio before showing text.",
    group: "support",
  },
  {
    key: "keyboardOptimized",
    label: "Keyboard-friendly",
    help: "Tune controls for keyboard navigation.",
    group: "support",
  },
  // Sprint 7 — AAC bridge. Turning this on mounts the AACTargetProvider
  // around the lesson player and tutor/homework chat composers. Input
  // method + scan delay live on AccessibilityPreferences too; the form
  // currently exposes the on/off toggle and defaults to single-switch
  // touch input — the device-pairing UI is a follow-up.
  {
    key: "aacEnabled",
    label: "AAC support",
    help: "Turn on switch-scan / eye-gaze input. Space activates; ArrowRight advances the scanner.",
    group: "aac",
  },
];

const GROUP_LABEL: Record<"reading" | "motion" | "support" | "aac", string> = {
  reading: "Reading & display",
  motion: "Motion & feedback",
  support: "Learning supports",
  aac: "Assistive input (AAC)",
};

type Props = {
  learnerId: string;
  initial: AccessibilityPreferences;
};

export function AccessibilityForm({ learnerId, initial }: Props) {
  const tVoice = useTranslations("learner.accessibility_voice");
  const router = useRouter();
  const [prefs, setPrefs] = useState(initial);
  const [status, setStatus] = useState<null | "saved" | "reset" | "error">(null);
  const [saving, startSaving] = useTransition();

  function toggle(key: (typeof TOGGLES)[number]["key"]) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
    setStatus(null);
  }

  function setAac<K extends "aacInputMethod" | "aacScanDelayMs">(
    key: K,
    value: AccessibilityPreferences[K],
  ) {
    setPrefs((p) => ({ ...p, [key]: value }));
    setStatus(null);
  }

  function save() {
    const patch: Record<string, unknown> = Object.fromEntries(
      TOGGLES.map((t) => [t.key, prefs[t.key]]),
    );
    // When AAC is on, persist the input method + scan delay alongside the
    // on/off flag so the lesson player can configure the scanner correctly.
    if (prefs.aacEnabled) {
      patch.aacInputMethod = prefs.aacInputMethod;
      patch.aacScanDelayMs = prefs.aacScanDelayMs;
    }
    startSaving(async () => {
      const res = await fetch(`/api/bff/learners/${learnerId}/accessibility`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const data = await res.json();
        setPrefs(data.data.accessibility);
        setStatus("saved");
        router.refresh();
      } else {
        setStatus("error");
      }
    });
  }

  function reset() {
    startSaving(async () => {
      const res = await fetch(`/api/bff/learners/${learnerId}/accessibility/reset`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setPrefs(data.data.accessibility);
        setStatus("reset");
        router.refresh();
      } else {
        setStatus("error");
      }
    });
  }

  const groups: Array<"reading" | "motion" | "support" | "aac"> = [
    "reading",
    "motion",
    "support",
    "aac",
  ];

  const AAC_INPUT_METHODS: Array<{ value: AccessibilityPreferences["aacInputMethod"]; label: string }> = [
    { value: "touch", label: "Touch / direct select" },
    { value: "switch_1", label: "Single switch (auto-scan)" },
    { value: "switch_2", label: "Two switches (step scan)" },
    { value: "eye_gaze", label: "Eye gaze" },
    { value: "head_pointer", label: "Head pointer" },
  ];

  return (
    <div className="grid gap-4">
      {groups.map((g) => (
        <Card key={g} className="p-5">
          <p className="mb-3 font-semibold">{GROUP_LABEL[g]}</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {TOGGLES.filter((t) => t.group === g).map((t) => (
              <li
                key={t.key}
                className="flex items-start gap-3 rounded-md border border-aivo-line p-3"
              >
                <Checkbox
                  id={t.key}
                  checked={Boolean(prefs[t.key])}
                  onCheckedChange={() => toggle(t.key)}
                />
                <div className="flex-1">
                  <Label htmlFor={t.key} className="font-medium">
                    {t.label}
                  </Label>
                  <p className="text-xs text-aivo-ink-soft">{t.help}</p>
                </div>
              </li>
            ))}
          </ul>

          {g === "reading" && (
            <p className="mt-4 rounded-md border border-aivo-line p-3 text-sm">
              <span className="font-medium">{tVoice("title")}</span>{" "}
              <span className="text-aivo-ink-soft">{tVoice("body")}</span>{" "}
              <Link
                href="/learner/settings/audio"
                className="font-semibold text-iw-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring rounded"
              >
                {tVoice("link")}
              </Link>
            </p>
          )}

          {g === "aac" && prefs.aacEnabled && (
            <div className="mt-4 grid gap-4 rounded-md border border-aivo-line p-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="aacInputMethod" className="font-medium">
                  Input method
                </Label>
                <select
                  id="aacInputMethod"
                  value={prefs.aacInputMethod}
                  onChange={(e) =>
                    setAac(
                      "aacInputMethod",
                      e.target.value as AccessibilityPreferences["aacInputMethod"],
                    )
                  }
                  className="rounded-md border border-aivo-line bg-transparent px-2 py-2 text-sm"
                >
                  {AAC_INPUT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="aacScanDelayMs" className="font-medium">
                  Scan / dwell time (ms)
                </Label>
                <input
                  id="aacScanDelayMs"
                  type="number"
                  min={300}
                  max={5000}
                  step={100}
                  value={prefs.aacScanDelayMs}
                  onChange={(e) => {
                    const n = Math.min(5000, Math.max(300, Number(e.target.value) || 1200));
                    setAac("aacScanDelayMs", n);
                  }}
                  className="rounded-md border border-aivo-line bg-transparent px-2 py-2 text-sm"
                />
                <p className="text-xs text-aivo-ink-soft">
                  How long the scanner waits on each option (300–5000 ms).
                </p>
              </div>
            </div>
          )}
        </Card>
      ))}

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-aivo-ink-soft" aria-live="polite">
          {status === "saved" && "Saved."}
          {status === "reset" && "Reset to defaults."}
          {status === "error" && "Could not save — try again."}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={reset} disabled={saving}>
            Reset to defaults
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
