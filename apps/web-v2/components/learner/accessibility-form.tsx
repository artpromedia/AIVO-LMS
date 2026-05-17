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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { AccessibilityPreferences } from "@/lib/db/types";

const TOGGLES: Array<{
  key: keyof Omit<AccessibilityPreferences, "learnerId" | "tenantId" | "updatedAt">;
  label: string;
  help: string;
  group: "reading" | "motion" | "support";
}> = [
  { key: "readAloud", label: "Read aloud", help: "Announces lesson text for screen readers and assistive tools.", group: "reading" },
  { key: "largeText", label: "Larger text", help: "Bigger type and looser line spacing.", group: "reading" },
  { key: "dyslexiaFriendlyFont", label: "Dyslexia-friendly font", help: "Switches the lesson font to a wider, evenly-spaced face.", group: "reading" },
  { key: "highContrast", label: "High contrast", help: "Higher contrast colors for better visibility.", group: "reading" },
  { key: "captionsAlwaysOn", label: "Captions on", help: "Show captions whenever the tutor speaks.", group: "reading" },
  { key: "reducedMotion", label: "Reduce motion", help: "Skips background animation and transitions.", group: "motion" },
  { key: "hapticsEnabled", label: "Haptic feedback", help: "Small vibration on mobile when a choice is selected.", group: "motion" },
  { key: "shorterSteps", label: "Shorter steps", help: "Trims the lesson to the essentials.", group: "support" },
  { key: "extraHints", label: "Extra hints", help: "More guidance during practice.", group: "support" },
  { key: "visualSupports", label: "Visual supports", help: "Add icons and diagrams where helpful.", group: "support" },
  { key: "breakReminders", label: "Break reminders", help: "Gentle prompts to take a break.", group: "support" },
  { key: "audioFirst", label: "Audio first", help: "Lead with audio before showing text.", group: "support" },
  { key: "keyboardOptimized", label: "Keyboard-friendly", help: "Tune controls for keyboard navigation.", group: "support" },
];

const GROUP_LABEL: Record<"reading" | "motion" | "support", string> = {
  reading: "Reading & display",
  motion: "Motion & feedback",
  support: "Learning supports",
};

type Props = {
  learnerId: string;
  initial: AccessibilityPreferences;
};

export function AccessibilityForm({ learnerId, initial }: Props) {
  const router = useRouter();
  const [prefs, setPrefs] = useState(initial);
  const [status, setStatus] = useState<null | "saved" | "reset" | "error">(null);
  const [saving, startSaving] = useTransition();

  function toggle(key: (typeof TOGGLES)[number]["key"]) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
    setStatus(null);
  }

  function save() {
    const patch = Object.fromEntries(
      TOGGLES.map((t) => [t.key, prefs[t.key]]),
    );
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
      const res = await fetch(
        `/api/bff/learners/${learnerId}/accessibility/reset`,
        { method: "POST" },
      );
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

  const groups: Array<"reading" | "motion" | "support"> = ["reading", "motion", "support"];

  return (
    <div className="grid gap-4">
      {groups.map((g) => (
        <Card key={g} className="p-5">
          <p className="mb-3 font-semibold">{GROUP_LABEL[g]}</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {TOGGLES.filter((t) => t.group === g).map((t) => (
              <li key={t.key} className="flex items-start gap-3 rounded-md border border-aivo-line p-3">
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
