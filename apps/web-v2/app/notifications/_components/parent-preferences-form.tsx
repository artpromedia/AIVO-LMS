"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { NotificationPreference } from "@/lib/db/types";

const TYPES: { value: string; label: string }[] = [
  { value: "parent_progress_summary", label: "Weekly progress summary" },
  { value: "baseline_completed", label: "Baseline adventure finished" },
  { value: "lesson_completed", label: "Lesson completed" },
  { value: "teacher_assignment_created", label: "New teacher assignment" },
  { value: "teacher_assignment_due", label: "Assignment due reminder" },
  { value: "streak_reminder", label: "Streak reminder" },
  { value: "quest_unlocked", label: "New quest unlocked" },
  { value: "iep_extraction_ready", label: "IEP extraction ready" },
  { value: "data_request_completed", label: "Data request completed" },
  { value: "billing_notice", label: "Billing notice" },
  { value: "safety_review_required", label: "Safety review required" },
];

const CHANNELS = ["in_app", "email", "push"] as const;

export function ParentPreferencesForm({ preference }: { preference: NotificationPreference }) {
  const t = useTranslations("parent.notifications");
  const [prefs, setPrefs] = useState<Record<string, boolean>>(preference.preferences);
  const [quietHours, setQuietHours] = useState(preference.quietHours ?? "");
  const [cadence, setCadence] = useState(preference.digestCadence);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggle(key: string) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/bff/notification-preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          preferences: prefs,
          quietHours: quietHours.trim() === "" ? null : quietHours.trim(),
          digestCadence: cadence,
        }),
      });
      const body = await res.json();
      if (!body.ok) {
        setErr(body.error?.message ?? "Save failed.");
        return;
      }
      setSaved(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-aivo-border text-left text-xs uppercase tracking-wide text-aivo-muted">
              <th className="py-2 pr-3">Type</th>
              {CHANNELS.map((c) => (
                <th key={c} className="py-2 pr-3">
                  {c.replace("_", "-")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TYPES.map((t) => (
              <tr key={t.value} className="border-b border-aivo-border/60">
                <td className="py-2 pr-3">{t.label}</td>
                {CHANNELS.map((c) => {
                  const key = `${t.value}:${c}`;
                  return (
                    <td key={c} className="py-2 pr-3">
                      <input
                        type="checkbox"
                        checked={prefs[key] ?? false}
                        onChange={() => toggle(key)}
                        aria-label={`${t.label} on ${c}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="block text-xs font-semibold uppercase tracking-wide text-aivo-muted">
            {t("prefs_quiet_hours")}
          </span>
          <input
            type="text"
            placeholder={t("prefs_quiet_hours_placeholder")}
            value={quietHours}
            onChange={(e) => {
              setQuietHours(e.target.value);
              setSaved(false);
            }}
            className="mt-1 w-full rounded-md border border-aivo-border bg-aivo-surface px-3 py-2 text-sm"
            pattern="\d{2}:\d{2}-\d{2}:\d{2}"
          />
        </label>
        <label className="block text-sm">
          <span className="block text-xs font-semibold uppercase tracking-wide text-aivo-muted">
            {t("prefs_digest_cadence")}
          </span>
          <select
            value={cadence}
            onChange={(e) => {
              setCadence(e.target.value as typeof cadence);
              setSaved(false);
            }}
            className="mt-1 w-full rounded-md border border-aivo-border bg-aivo-surface px-3 py-2 text-sm"
          >
            <option value="daily">{t("prefs_cadence_daily")}</option>
            <option value="weekly">{t("prefs_cadence_weekly")}</option>
            <option value="off">{t("prefs_cadence_off")}</option>
          </select>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? t("prefs_saving") : t("prefs_save")}
        </Button>
        {saved ? <span className="text-sm text-aivo-success">{t("prefs_saved")}</span> : null}
        {err ? (
          <span role="alert" className="text-sm text-aivo-danger">
            {err}
          </span>
        ) : null}
      </div>
    </div>
  );
}
