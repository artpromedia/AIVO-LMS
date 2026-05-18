"use client";
import { useAuth } from "@/providers/auth-provider";
import { useParams } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Check, Sun, CloudSun, Moon } from "lucide-react";
import { gradeToTier, type AgeTier } from "@aivo/learner-ui";
import { LocalisedTierBadge } from "@/components/LocalisedTierBadge";

interface Settings {
  accommodations: {
    readAloud: boolean;
    simplifiedUI: boolean;
    extendedTime: boolean;
    breakReminders: boolean;
    visualSupports: boolean;
    reducedAnimations: boolean;
    highContrast: boolean;
    fontSize: "normal" | "large" | "extra_large";
  };
  learningGoals: {
    dailyGoalMinutes: number;
    weeklySessionTarget: number;
    preferredSessionTime: "morning" | "afternoon" | "evening";
  };
  notifications: {
    milestoneAlerts: boolean;
    struggleAlerts: boolean;
    weeklyDigest: boolean;
    sessionReminders: boolean;
    iepReminders: boolean;
  };
  tutorPreferences: {
    preferredTutorKey: string | null;
    sessionLengthPreference: "short" | "medium" | "long";
    musicDuringSessions: boolean;
    celebrationAnimations: boolean;
  };
}

const DEFAULT_SETTINGS: Settings = {
  accommodations: {
    readAloud: true,
    simplifiedUI: false,
    extendedTime: false,
    breakReminders: true,
    visualSupports: false,
    reducedAnimations: false,
    highContrast: false,
    fontSize: "normal",
  },
  learningGoals: {
    dailyGoalMinutes: 30,
    weeklySessionTarget: 5,
    preferredSessionTime: "afternoon",
  },
  notifications: {
    milestoneAlerts: true,
    struggleAlerts: true,
    weeklyDigest: true,
    sessionReminders: false,
    iepReminders: true,
  },
  tutorPreferences: {
    preferredTutorKey: null,
    sessionLengthPreference: "medium",
    musicDuringSessions: false,
    celebrationAnimations: true,
  },
};

export default function ParentLearnerSettingsPage() {
  const { user, accessToken, loading } = useAuth();
  const params = useParams();
  const learnerId = params.id as string;
  const t = useTranslations("parent");

  const [learnerName, setLearnerName] = useState("Learner");
  const [learnerTier, setLearnerTier] = useState<AgeTier | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loadingData, setLoadingData] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const debounceRef = useRef<any>(null);

  useEffect(() => {
    if (!accessToken || !learnerId) return;

    Promise.all([
      fetch("/api/users/learners", { headers: { Authorization: `Bearer ${accessToken}` } })
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => {
          const found = (Array.isArray(data) ? data : []).find((l: any) => l.id === learnerId);
          if (found) {
            setLearnerName(found.name);
            setLearnerTier(gradeToTier(found.gradeLevel ?? null));
          }
        }),
      fetch(`/api/family/learner-settings/${learnerId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) {
            setSettings({
              accommodations: {
                ...DEFAULT_SETTINGS.accommodations,
                ...(data.accommodations || {}),
              },
              learningGoals: { ...DEFAULT_SETTINGS.learningGoals, ...(data.learningGoals || {}) },
              notifications: { ...DEFAULT_SETTINGS.notifications, ...(data.notifications || {}) },
              tutorPreferences: {
                ...DEFAULT_SETTINGS.tutorPreferences,
                ...(data.tutorPreferences || {}),
              },
            });
          }
        }),
    ]).finally(() => setLoadingData(false));
  }, [accessToken, learnerId]);

  const saveSettings = useCallback(
    async (newSettings: Settings) => {
      if (!accessToken) return;
      setSaveStatus("saving");
      try {
        const res = await fetch(`/api/family/learner-settings/${learnerId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify(newSettings),
        });
        if (res.ok) {
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);
        } else {
          setSaveStatus("error");
          setTimeout(() => setSaveStatus("idle"), 3000);
        }
      } catch {
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 3000);
      }
    },
    [accessToken, learnerId],
  );

  const updateSettings = useCallback(
    (newSettings: Settings) => {
      setSettings(newSettings);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => saveSettings(newSettings), 300);
    },
    [saveSettings],
  );

  const updateAccommodation = (key: keyof Settings["accommodations"], value: any) => {
    updateSettings({ ...settings, accommodations: { ...settings.accommodations, [key]: value } });
  };

  const updateGoals = (key: keyof Settings["learningGoals"], value: any) => {
    updateSettings({ ...settings, learningGoals: { ...settings.learningGoals, [key]: value } });
  };

  const updateNotifications = (key: keyof Settings["notifications"], value: any) => {
    updateSettings({ ...settings, notifications: { ...settings.notifications, [key]: value } });
  };

  const updateTutor = (key: keyof Settings["tutorPreferences"], value: any) => {
    updateSettings({
      ...settings,
      tutorPreferences: { ...settings.tutorPreferences, [key]: value },
    });
  };

  if (loading || !user) return null;

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!value)}
      aria-pressed={value}
      className={`w-11 h-6 rounded-full transition relative flex-shrink-0 ${value ? "bg-[hsl(var(--visual-primary))]" : "bg-[hsl(var(--visual-border))]"}`}
      style={{ minWidth: 44, minHeight: 24 }}
    >
      <span
        className={`absolute w-5 h-5 rounded-full bg-white shadow top-0.5 transition ${value ? "left-[22px]" : "left-0.5"}`}
      />
    </button>
  );

  const SettingRow = ({
    label,
    description,
    children,
  }: {
    label: string;
    description: string;
    children: React.ReactNode;
  }) => (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="min-w-0">
        <p className="text-sm font-semibold vi-text">{label}</p>
        <p className="text-xs vi-text-muted leading-relaxed">{description}</p>
      </div>
      {children}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-heading font-bold vi-text">
          {t("settings_title", { name: learnerName })}
        </h1>
        {learnerTier && <LocalisedTierBadge tier={learnerTier} size="md" showTagline />}
        {saveStatus === "saving" && (
          <span className="text-xs vi-text-muted animate-pulse">Saving...</span>
        )}
        {saveStatus === "saved" && (
          <span className="inline-flex items-center gap-1 text-xs text-[hsl(var(--visual-science))] font-semibold">
            <Check size={12} strokeWidth={3} aria-hidden="true" /> Saved
          </span>
        )}
        {saveStatus === "error" && (
          <span className="text-xs text-[hsl(var(--visual-math))] font-semibold">
            Save failed — try again
          </span>
        )}
      </div>

      {loadingData ? (
        <div className="text-center py-16 vi-text-muted animate-pulse">Loading settings...</div>
      ) : (
        <div className="space-y-6">
          <div className="vi-card p-5 lg:p-6">
            <h2 className="font-heading font-bold text-lg vi-text mb-4">
              Accessibility & Accommodations
            </h2>
            <div className="space-y-4">
              <SettingRow label={t("read_aloud")} description={t("read_aloud_desc")}>
                <Toggle
                  value={settings.accommodations.readAloud}
                  onChange={(v) => updateAccommodation("readAloud", v)}
                />
              </SettingRow>
              <SettingRow label={t("simplified_ui")} description={t("simplified_ui_desc")}>
                <Toggle
                  value={settings.accommodations.simplifiedUI}
                  onChange={(v) => updateAccommodation("simplifiedUI", v)}
                />
              </SettingRow>
              <SettingRow label={t("extended_time")} description={t("extended_time_desc")}>
                <Toggle
                  value={settings.accommodations.extendedTime}
                  onChange={(v) => updateAccommodation("extendedTime", v)}
                />
              </SettingRow>
              <SettingRow label={t("break_reminders")} description={t("break_reminders_desc")}>
                <Toggle
                  value={settings.accommodations.breakReminders}
                  onChange={(v) => updateAccommodation("breakReminders", v)}
                />
              </SettingRow>
              <SettingRow
                label="Visual Supports"
                description="Show picture symbols alongside text in tutor sessions"
              >
                <Toggle
                  value={settings.accommodations.visualSupports}
                  onChange={(v) => updateAccommodation("visualSupports", v)}
                />
              </SettingRow>
              <SettingRow
                label="Reduced Animations"
                description="Minimize motion in UI and tutor sessions for sensory sensitivity"
              >
                <Toggle
                  value={settings.accommodations.reducedAnimations}
                  onChange={(v) => updateAccommodation("reducedAnimations", v)}
                />
              </SettingRow>
              <SettingRow
                label="High Contrast"
                description="Increase contrast ratios for better visual processing"
              >
                <Toggle
                  value={settings.accommodations.highContrast}
                  onChange={(v) => updateAccommodation("highContrast", v)}
                />
              </SettingRow>
              <div className="flex items-center justify-between gap-4 py-1">
                <div>
                  <p className="text-sm font-semibold vi-text">Font Size</p>
                  <p className="text-xs vi-text-muted">Adjust text size for better readability</p>
                </div>
                <div className="flex gap-1">
                  {(["normal", "large", "extra_large"] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => updateAccommodation("fontSize", size)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${settings.accommodations.fontSize === size ? "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]" : "vi-surface-soft vi-text-muted hover:bg-[hsl(var(--visual-border))]"}`}
                      style={{ minHeight: 32 }}
                    >
                      {size === "normal" ? "A" : size === "large" ? "A+" : "A++"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="vi-card p-5 lg:p-6">
            <h2 className="font-heading font-bold text-lg vi-text mb-4">Learning Goals</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="daily-goal-minutes" className="text-sm font-semibold vi-text">
                  {t("daily_goal_label")}
                </label>
                <div className="flex items-center gap-4 mt-2">
                  <input
                    id="daily-goal-minutes"
                    type="range"
                    min={10}
                    max={120}
                    step={5}
                    value={settings.learningGoals.dailyGoalMinutes}
                    onChange={(e) => updateGoals("dailyGoalMinutes", Number(e.target.value))}
                    className="flex-1 accent-[hsl(var(--visual-primary))]"
                  />
                  <span className="text-lg font-bold text-[hsl(var(--visual-primary))] w-16 text-right">
                    {settings.learningGoals.dailyGoalMinutes}m
                  </span>
                </div>
                <p className="text-xs vi-text-muted mt-1">{t("daily_goal_recommended")}</p>
              </div>
              <div>
                <label htmlFor="weekly-session-target" className="text-sm font-semibold vi-text">
                  Weekly Session Target
                </label>
                <div className="flex items-center gap-4 mt-2">
                  <input
                    id="weekly-session-target"
                    type="range"
                    min={1}
                    max={14}
                    step={1}
                    value={settings.learningGoals.weeklySessionTarget}
                    onChange={(e) => updateGoals("weeklySessionTarget", Number(e.target.value))}
                    className="flex-1 accent-[hsl(var(--visual-primary))]"
                  />
                  <span className="text-lg font-bold text-[hsl(var(--visual-primary))] w-20 text-right">
                    {settings.learningGoals.weeklySessionTarget}/week
                  </span>
                </div>
              </div>
              <div>
                <span className="text-sm font-semibold vi-text">Preferred Time</span>
                <div className="flex gap-2 mt-2">
                  {(["morning", "afternoon", "evening"] as const).map((time) => {
                    const TimeIcon =
                      time === "morning" ? Sun : time === "afternoon" ? CloudSun : Moon;
                    return (
                      <button
                        key={time}
                        onClick={() => updateGoals("preferredSessionTime", time)}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition capitalize ${settings.learningGoals.preferredSessionTime === time ? "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]" : "vi-surface-soft vi-text-muted hover:bg-[hsl(var(--visual-border))]"}`}
                        style={{ minHeight: 44 }}
                      >
                        <TimeIcon size={16} strokeWidth={2.5} aria-hidden="true" />
                        {time}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="vi-card p-5 lg:p-6">
            <h2 className="font-heading font-bold text-lg vi-text mb-4">Notifications</h2>
            <div className="space-y-4">
              <SettingRow
                label={t("milestone_notifications")}
                description={t("milestone_desc", { name: learnerName })}
              >
                <Toggle
                  value={settings.notifications.milestoneAlerts}
                  onChange={(v) => updateNotifications("milestoneAlerts", v)}
                />
              </SettingRow>
              <SettingRow
                label={t("struggle_alerts")}
                description={t("struggle_desc", { name: learnerName })}
              >
                <Toggle
                  value={settings.notifications.struggleAlerts}
                  onChange={(v) => updateNotifications("struggleAlerts", v)}
                />
              </SettingRow>
              <SettingRow
                label="Weekly Digest"
                description="Get a weekly summary of progress and achievements"
              >
                <Toggle
                  value={settings.notifications.weeklyDigest}
                  onChange={(v) => updateNotifications("weeklyDigest", v)}
                />
              </SettingRow>
              <SettingRow
                label="Session Reminders"
                description="Gentle reminders when it's time for a learning session"
              >
                <Toggle
                  value={settings.notifications.sessionReminders}
                  onChange={(v) => updateNotifications("sessionReminders", v)}
                />
              </SettingRow>
              <SettingRow label="IEP Reminders" description="Alerts before IEP review dates">
                <Toggle
                  value={settings.notifications.iepReminders}
                  onChange={(v) => updateNotifications("iepReminders", v)}
                />
              </SettingRow>
            </div>
          </div>

          <div className="vi-card p-5 lg:p-6">
            <h2 className="font-heading font-bold text-lg vi-text mb-4">
              Tutor Session Preferences
            </h2>
            <div className="space-y-4">
              <div>
                <span className="text-sm font-semibold vi-text">Session Length</span>
                <div className="flex gap-2 mt-2">
                  {[
                    { key: "short" as const, label: "Short (10 min)" },
                    { key: "medium" as const, label: "Medium (20 min)" },
                    { key: "long" as const, label: "Long (30 min)" },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => updateTutor("sessionLengthPreference", opt.key)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${settings.tutorPreferences.sessionLengthPreference === opt.key ? "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]" : "vi-surface-soft vi-text-muted hover:bg-[hsl(var(--visual-border))]"}`}
                      style={{ minHeight: 44 }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <SettingRow
                label="Music During Sessions"
                description="Background music while tutoring (can be distracting for some children)"
              >
                <Toggle
                  value={settings.tutorPreferences.musicDuringSessions}
                  onChange={(v) => updateTutor("musicDuringSessions", v)}
                />
              </SettingRow>
              <SettingRow
                label="Celebration Animations"
                description="Confetti and celebration effects on achievements (can be overstimulating)"
              >
                <Toggle
                  value={settings.tutorPreferences.celebrationAnimations}
                  onChange={(v) => updateTutor("celebrationAnimations", v)}
                />
              </SettingRow>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
