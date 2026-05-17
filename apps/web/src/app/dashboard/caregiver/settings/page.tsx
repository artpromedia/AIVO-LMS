"use client";
import { useAuth } from "@/providers/auth-provider";
import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { AccessibleToggle } from "@/components/a11y/AccessibleToggle";
import { MfaSettings } from "@/components/settings/MfaSettings";
import { AvatarUploader } from "@/components/AvatarUploader";

export default function CaregiverSettingsPage() {
  const { user, accessToken, loading } = useAuth();
  const td = useTranslations("dashboard");
  const tc = useTranslations("common");
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [dailySummary, setDailySummary] = useState(true);
  const [iepAlerts, setIepAlerts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (user) setAvatarUrl((user as { avatarUrl?: string | null }).avatarUrl ?? null);
  }, [user]);

  const fetchPreferences = useCallback(async () => {
    if (!accessToken || !user) return;
    try {
      const res = await fetch(`/api/comms/preferences/${user.id}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (res.ok) {
        const data = await res.json();
        if (data.email !== undefined) setEmailNotifs(data.email);
        if (data.dailySummary !== undefined) setDailySummary(data.dailySummary);
        if (data.iepAlerts !== undefined) setIepAlerts(data.iepAlerts);
      }
    } catch { /* use defaults */ }
    setLoadingPrefs(false);
  }, [accessToken, user]);

  useEffect(() => { fetchPreferences(); }, [fetchPreferences]);

  if (loading || !user) return null;

  const handleSaveSettings = async () => {
    setSaving(true);
    setSaveStatus("idle");
    try {
      const res = await fetch(`/api/comms/preferences/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ email: emailNotifs, dailySummary, iepAlerts }),
      });
      setSaveStatus(res.ok ? "success" : "error");
    } catch {
      setSaveStatus("error");
    }
    setSaving(false);
    if (saveStatus !== "error") setTimeout(() => setSaveStatus("idle"), 3000);
  };

  return (
    <div className="p-8 max-w-2xl space-y-6">
      <h1 className="text-3xl font-heading font-bold vi-text">Settings</h1>

      <div className="vi-card p-6 space-y-5">
        <h2 className="font-heading font-bold text-lg vi-text">{tc("avatar_section_title")}</h2>
        <AvatarUploader
          currentAvatarUrl={avatarUrl}
          userName={user.name}
          accessToken={accessToken}
          onChange={(newUrl) => setAvatarUrl(newUrl)}
        />
      </div>

      <div className="vi-card p-6">
        <h2 className="font-heading font-bold text-lg vi-text mb-4">{td("overview")}</h2>
        <div className="space-y-3">
          <div>
            <p className="text-xs vi-text-muted font-semibold uppercase">Name</p>
            <p className="vi-text font-medium">{user.name}</p>
          </div>
          <div>
            <p className="text-xs vi-text-muted font-semibold uppercase">Email</p>
            <p className="vi-text font-medium">{user.email}</p>
          </div>
          <div>
            <p className="text-xs vi-text-muted font-semibold uppercase">Role</p>
            <p className="text-[hsl(var(--visual-science))] font-semibold">Caregiver</p>
          </div>
        </div>
      </div>

      <div className="vi-card p-6">
        <h2 className="font-heading font-bold text-lg vi-text mb-4">{tc("details")}</h2>
        {loadingPrefs ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-12 vi-surface-soft rounded-xl animate-pulse motion-reduce:animate-none" />)}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold vi-text" id="email-notifs-label">Email Notifications</p>
                <p className="text-xs vi-text-muted" id="email-notifs-desc">Receive email updates about your learners</p>
              </div>
              <AccessibleToggle id="email-notifs" value={emailNotifs} onChange={setEmailNotifs} label="Email Notifications" description="Receive email updates about your learners" color="bg-[hsl(var(--visual-science))]" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold vi-text" id="daily-summary-label">Daily Summary</p>
                <p className="text-xs vi-text-muted" id="daily-summary-desc">Daily overview of learner activities and progress</p>
              </div>
              <AccessibleToggle id="daily-summary" value={dailySummary} onChange={setDailySummary} label="Daily Summary" description="Daily overview of learner activities and progress" color="bg-[hsl(var(--visual-science))]" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold vi-text" id="iep-alerts-label">IEP Goal Alerts</p>
                <p className="text-xs vi-text-muted" id="iep-alerts-desc">Notifications when IEP goals are updated or milestones reached</p>
              </div>
              <AccessibleToggle id="iep-alerts" value={iepAlerts} onChange={setIepAlerts} label="IEP Goal Alerts" description="Notifications when IEP goals are updated or milestones reached" color="bg-[hsl(var(--visual-science))]" />
            </div>
          </div>
        )}
        {saveStatus === "success" && <p className="text-sm text-[hsl(var(--visual-science))] mt-3 font-medium" role="status" aria-live="polite">Settings saved!</p>}
        {saveStatus === "error" && <p className="text-sm text-[hsl(var(--visual-math))] mt-3 font-medium" role="alert">Failed to save settings. Please try again.</p>}
        <button onClick={handleSaveSettings} disabled={saving} aria-busy={saving}
          style={{ minHeight: 44 }}
          className="mt-4 px-6 py-2.5 rounded-xl bg-[hsl(var(--visual-primary))] text-white font-heading font-black uppercase tracking-wider text-sm hover:bg-[hsl(var(--visual-primary)/0.9)] transition disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--visual-primary))] focus-visible:ring-offset-2">
          {saving ? "Saving..." : "Save Preferences"}
        </button>
      </div>

      <MfaSettings accentColor="green" />
    </div>
  );
}
