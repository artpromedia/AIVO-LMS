"use client";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState, useCallback } from "react";
import { IconWell, StatIconWell } from "@/components/discovery/_vi";
import { Settings, Lock, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { fetchWithStepUp } from "@/lib/step-up";

interface DistrictSettingsData {
  notificationPrefs: Record<string, boolean>;
  ssoConfig: Record<string, any>;
  branding: Record<string, any>;
  featureOverrides: Record<string, boolean>;
}

export default function DistrictSettingsPage() {
  const { accessToken, user } = useAuth();
  const [tenant, setTenant] = useState<any>(null);
  const [settings, setSettings] = useState<DistrictSettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    if (!accessToken) return;
    const headers = { Authorization: `Bearer ${accessToken}` };
    Promise.all([
      fetch("/api/district/tenant", { headers }).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/district/settings", { headers }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([t, s]) => {
        setTenant(t);
        setSettings(
          s || { notificationPrefs: {}, ssoConfig: {}, branding: {}, featureOverrides: {} },
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken]);

  const saveSettings = useCallback(
    async (updated: DistrictSettingsData) => {
      if (!accessToken) return;
      setSaving(true);
      setSaveMsg("");
      try {
        const res = await fetch("/api/district/settings", {
          method: "PUT",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(updated),
        });
        if (res.ok) {
          const data = await res.json();
          setSettings(data);
          setSaveMsg("Settings saved");
          setTimeout(() => setSaveMsg(""), 2000);
        }
      } catch {
      } finally {
        setSaving(false);
      }
    },
    [accessToken],
  );

  const togglePref = (key: string) => {
    if (!settings) return;
    const updated = {
      ...settings,
      notificationPrefs: { ...settings.notificationPrefs, [key]: !settings.notificationPrefs[key] },
    };
    setSettings(updated);
    saveSettings(updated);
  };

  const toggleFeature = (key: string) => {
    if (!settings) return;
    const updated = {
      ...settings,
      featureOverrides: { ...settings.featureOverrides, [key]: !settings.featureOverrides[key] },
    };
    setSettings(updated);
    saveSettings(updated);
  };

  if (loading) {
    return (
      <div className="p-8 animate-pulse space-y-4">
        <div className="h-8 bg-slate-200 rounded-lg w-48" />
        <div className="h-64 bg-slate-200 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <IconWell color="primary">
            <Settings size={28} strokeWidth={2.5} aria-hidden="true" />
          </IconWell>
          <div>
            <h1 className="text-2xl font-heading font-bold vi-text">District Settings</h1>
            <p className="text-sm vi-text-muted mt-1">
              Configure your district organization and preferences.
            </p>
          </div>
        </div>
        {saveMsg && <span className="text-sm text-emerald-600 font-medium">{saveMsg}</span>}
      </header>

      {tenant && (
        <div className="vi-card p-6 space-y-4">
          <h2 className="text-lg font-heading font-semibold vi-text">Organization Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SettingsField label="Organization Name" value={tenant.name} />
            <SettingsField label="Organization Type" value={tenant.type} />
            <SettingsField label="Slug" value={tenant.slug} />
            <SettingsField label="ID" value={tenant.id} mono />
            <SettingsField
              label="Created"
              value={new Date(tenant.createdAt).toLocaleDateString()}
            />
          </div>
        </div>
      )}

      <div className="vi-card p-6 space-y-4">
        <h2 className="text-lg font-heading font-semibold vi-text">Account Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SettingsField label="Admin Name" value={user?.name || "—"} />
          <SettingsField label="Email" value={user?.email || "—"} />
          <SettingsField label="Role" value={user?.role.replace(/_/g, " ") || "—"} />
        </div>
      </div>

      <div className="vi-card p-6 space-y-4">
        <h2 className="text-lg font-heading font-semibold vi-text">Notification Preferences</h2>
        <div className="space-y-3">
          <ToggleSetting
            label="Email notifications for new enrollments"
            checked={settings?.notificationPrefs?.newEnrollments !== false}
            onChange={() => togglePref("newEnrollments")}
          />
          <ToggleSetting
            label="Weekly performance digest email"
            checked={settings?.notificationPrefs?.weeklyDigest !== false}
            onChange={() => togglePref("weeklyDigest")}
          />
          <ToggleSetting
            label="Alert when usage exceeds 80% of limits"
            checked={settings?.notificationPrefs?.usageAlerts !== false}
            onChange={() => togglePref("usageAlerts")}
          />
          <ToggleSetting
            label="IEP review date reminders"
            checked={settings?.notificationPrefs?.iepReminders !== false}
            onChange={() => togglePref("iepReminders")}
          />
          <ToggleSetting
            label="Auto-approve teacher account requests"
            checked={settings?.notificationPrefs?.autoApproveTeachers === true}
            onChange={() => togglePref("autoApproveTeachers")}
          />
        </div>
      </div>

      <div className="vi-card p-6 space-y-4">
        <h2 className="text-lg font-heading font-semibold vi-text">Feature Overrides</h2>
        <div className="space-y-3">
          <ToggleSetting
            label="Enable AI tutor for all learners"
            checked={settings?.featureOverrides?.aiTutor !== false}
            onChange={() => toggleFeature("aiTutor")}
          />
          <ToggleSetting
            label="Enable sensory profiles"
            checked={settings?.featureOverrides?.sensoryProfiles !== false}
            onChange={() => toggleFeature("sensoryProfiles")}
          />
          <ToggleSetting
            label="Enable parent portal access"
            checked={settings?.featureOverrides?.parentPortal !== false}
            onChange={() => toggleFeature("parentPortal")}
          />
          <ToggleSetting
            label="Enable offline mode for mobile"
            checked={settings?.featureOverrides?.offlineMode !== false}
            onChange={() => toggleFeature("offlineMode")}
          />
        </div>
      </div>

      <MfaAdoptionWidget />

      <div className="vi-surface-soft rounded-2xl border border-[hsl(var(--visual-primary)/0.3)] p-6">
        <div className="flex items-start gap-3">
          <StatIconWell color="primary" className="flex-shrink-0">
            <Lock size={22} strokeWidth={2.5} aria-hidden="true" />
          </StatIconWell>
          <div>
            <h3 className="font-semibold text-violet-900">Advanced Settings</h3>
            <p className="text-sm text-[hsl(var(--visual-primary))] mt-1">
              For SSO configuration, branding customization, or API access, contact your platform
              administrator.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MfaStats {
  staff: { total: number; withMfa: number };
  admins: { total: number; withMfa: number };
  forceMfa: boolean;
}

function MfaAdoptionWidget() {
  const { accessToken } = useAuth();
  const [stats, setStats] = useState<MfaStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const r = await fetch("/api/district/admins/mfa-stats", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (r.ok) setStats(await r.json());
    } catch {
      /* fail-soft */
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleForce = async () => {
    if (!accessToken || !stats) return;
    const next = !stats.forceMfa;
    if (
      next &&
      !confirm(
        "Forcing MFA will require every district admin, teacher, therapist, and caregiver in your district to set up multi-factor authentication on their next login. Continue?",
      )
    )
      return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetchWithStepUp("/api/district/admins/force-mfa", {
        method: "PUT",
        accessToken,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "Failed to toggle");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to toggle");
    } finally {
      setBusy(false);
    }
  };

  if (!stats) return null;
  const staffPct = stats.staff.total
    ? Math.round((stats.staff.withMfa / stats.staff.total) * 100)
    : 0;
  const adminPct = stats.admins.total
    ? Math.round((stats.admins.withMfa / stats.admins.total) * 100)
    : 0;

  return (
    <div className="vi-card p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <StatIconWell color="primary" className="flex-shrink-0">
            <ShieldCheck size={22} strokeWidth={2.5} aria-hidden="true" />
          </StatIconWell>
          <div>
            <h2 className="text-lg font-heading font-semibold vi-text">
              Multi-factor authentication
            </h2>
            <p className="text-sm vi-text-muted mt-0.5">Adoption across your district staff.</p>
          </div>
        </div>
        <Link
          href="/dashboard/district/settings/admins"
          className="text-sm text-[hsl(var(--visual-primary))] font-medium hover:underline"
        >
          Manage administrators →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border vi-border p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-xs vi-text-muted uppercase tracking-wide">District Admins</span>
            <span className="text-xs font-medium vi-text-muted">
              {stats.admins.withMfa} / {stats.admins.total}
            </span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full bg-[hsl(var(--visual-primary))]"
              style={{ width: `${adminPct}%` }}
            />
          </div>
          <div className="mt-2 text-2xl font-bold vi-text">{adminPct}%</div>
        </div>
        <div className="rounded-xl border vi-border p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-xs vi-text-muted uppercase tracking-wide">All staff</span>
            <span className="text-xs font-medium vi-text-muted">
              {stats.staff.withMfa} / {stats.staff.total}
            </span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
            <div className="h-full bg-emerald-500" style={{ width: `${staffPct}%` }} />
          </div>
          <div className="mt-2 text-2xl font-bold vi-text">{staffPct}%</div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t vi-border">
        <div>
          <p className="text-sm font-medium vi-text">Force MFA for all district staff</p>
          <p className="text-xs vi-text-muted mt-0.5">
            When enabled, every staff login will require MFA enrollment regardless of personal
            preference.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={toggleForce}
          aria-pressed={stats.forceMfa}
          className={`w-11 h-6 rounded-full transition-colors relative disabled:opacity-50 ${stats.forceMfa ? "bg-[hsl(var(--visual-primary))]" : "bg-slate-300"}`}
        >
          <div
            className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${stats.forceMfa ? "left-6" : "left-1"}`}
          />
        </button>
      </div>
      {err && <p className="text-sm text-red-700">{err}</p>}
    </div>
  );
}

function SettingsField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1">
      <label className="text-xs vi-text-muted font-medium uppercase tracking-wide">{label}</label>
      <div
        className={`px-4 py-2.5 rounded-xl vi-bg border vi-border text-sm vi-text ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function ToggleSetting({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-xl hover:vi-bg transition">
      <span className="text-sm vi-text">{label}</span>
      <button
        onClick={onChange}
        className={`w-10 h-6 rounded-full transition-colors relative ${checked ? "bg-[hsl(var(--visual-primary))]" : "bg-slate-300"}`}
      >
        <div
          className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${checked ? "left-5" : "left-1"}`}
        />
      </button>
    </div>
  );
}
