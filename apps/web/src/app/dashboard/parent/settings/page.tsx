"use client";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { MfaSettings } from "@/components/settings/MfaSettings";
import { AvatarUploader } from "@/components/AvatarUploader";

export default function ParentSettingsPage() {
  const { user, accessToken, logout, loading } = useAuth();
  const router = useRouter();
  const t = useTranslations("parent");
  const tc = useTranslations("common");

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileMsg, setProfileMsg] = useState("");
  const [profileErr, setProfileErr] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  const [notifPrefs, setNotifPrefs] = useState({
    emailEnabled: true,
    emailDigest: "daily",
    emailMarketing: false,
    pushEnabled: true,
    pushSessionReminders: true,
    pushProgressUpdates: true,
    smsEnabled: false,
  });
  const [notifMsg, setNotifMsg] = useState("");

  const [learners, setLearners] = useState<{ id: string; name: string }[]>([]);
  const [deleteLearnerId, setDeleteLearnerId] = useState<string | null>(null);
  const [deleteLearnerConfirm, setDeleteLearnerConfirm] = useState("");
  const [deleteLearnerMsg, setDeleteLearnerMsg] = useState("");

  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteAccPw, setDeleteAccPw] = useState("");
  const [deleteAccErr, setDeleteAccErr] = useState("");
  const [deleteAccLoading, setDeleteAccLoading] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (!loading && user && user.role !== "PARENT") router.push("/");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      setProfileName(user.name || "");
      setProfileEmail(user.email || "");
      setAvatarUrl((user as any).avatarUrl ?? null);
    }
  }, [user]);

  useEffect(() => {
    if (!accessToken) return;
    fetch("/api/users/learners", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((data) => setLearners(Array.isArray(data) ? data : data.learners || []))
      .catch(() => {});

    fetch("/api/comms/preferences/" + user?.id, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.email) {
          setNotifPrefs({
            emailEnabled: data.email.enabled ?? true,
            emailDigest: data.email.digest ?? "daily",
            emailMarketing: data.email.marketing ?? false,
            pushEnabled: data.push?.enabled ?? true,
            pushSessionReminders: data.push?.sessionReminders ?? true,
            pushProgressUpdates: data.push?.progressUpdates ?? true,
            smsEnabled: data.sms?.enabled ?? false,
          });
        }
      })
      .catch(() => {});
  }, [accessToken, user?.id]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg("");
    setProfileErr("");
    setProfileLoading(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ name: profileName, email: profileEmail }),
      });
      const data = await res.json();
      if (!res.ok) setProfileErr(data.error || t("update_failed"));
      else setProfileMsg(t("profile_updated"));
    } catch {
      setProfileErr(t("network_error"));
    }
    setProfileLoading(false);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg("");
    setPwErr("");
    if (newPw !== confirmPw) {
      setPwErr(t("passwords_no_match"));
      return;
    }
    setPwLoading(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (!res.ok) setPwErr(data.error || t("password_change_failed"));
      else {
        setPwMsg(t("password_changed"));
        setCurrentPw("");
        setNewPw("");
        setConfirmPw("");
      }
    } catch {
      setPwErr(t("network_error"));
    }
    setPwLoading(false);
  };

  const handleNotifSave = async () => {
    setNotifMsg("");
    try {
      await fetch("/api/comms/preferences/" + user?.id, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          email: {
            enabled: notifPrefs.emailEnabled,
            digest: notifPrefs.emailDigest,
            marketing: notifPrefs.emailMarketing,
          },
          push: {
            enabled: notifPrefs.pushEnabled,
            sessionReminders: notifPrefs.pushSessionReminders,
            progressUpdates: notifPrefs.pushProgressUpdates,
          },
          sms: { enabled: notifPrefs.smsEnabled },
        }),
      });
      setNotifMsg(t("preferences_saved"));
    } catch {}
  };

  const handleDownloadData = async (learnerId: string) => {
    const res = await fetch(`/api/family/data-export/${learnerId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aivo-data-export-${learnerId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleDeleteLearner = async () => {
    if (!deleteLearnerId) return;
    const learner = learners.find((l) => l.id === deleteLearnerId);
    if (deleteLearnerConfirm !== learner?.name) {
      setDeleteLearnerMsg(t("name_mismatch"));
      return;
    }

    const res = await fetch(`/api/auth/learner/${deleteLearnerId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      setLearners(learners.filter((l) => l.id !== deleteLearnerId));
      setDeleteLearnerId(null);
      setDeleteLearnerConfirm("");
      setDeleteLearnerMsg(t("learner_removed"));
    } else {
      const data = await res.json();
      setDeleteLearnerMsg(data.error || t("failed_remove_tutor"));
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteAccErr("");
    setDeleteAccLoading(true);
    try {
      const res = await fetch("/api/auth/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ password: deleteAccPw }),
      });
      const data = await res.json();
      if (!res.ok) setDeleteAccErr(data.error || t("update_failed"));
      else {
        logout();
        router.push("/");
      }
    } catch {
      setDeleteAccErr(t("network_error"));
    }
    setDeleteAccLoading(false);
  };

  if (loading || !user) return null;

  return (
    <div className="vi-bg">
      <header className="bg-[hsl(var(--visual-surface)/0.95)] backdrop-blur border-b vi-border px-8 py-4 flex items-center justify-between">
        <Image
          src="/images/aivo-logo-purple.png"
          alt="AIVO"
          width={120}
          height={36}
          style={{ height: "auto" }}
        />
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/parent"
            className="text-sm text-[hsl(var(--visual-primary))] font-semibold hover:underline"
          >
            {t("dashboard")}
          </Link>
          <Link
            href="/dashboard/parent/billing"
            className="text-sm vi-text-muted font-semibold hover:text-[hsl(var(--visual-primary))]"
          >
            {t("billing_page_title")}
          </Link>
          <span className="text-sm font-semibold vi-text-muted">{user.name}</span>
          <button
            onClick={logout}
            className="text-sm vi-text-muted hover:text-[hsl(var(--visual-math))] font-semibold transition"
          >
            {t("logout")}
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-8 py-8 space-y-8">
        <h1 className="text-2xl font-heading font-bold vi-text">{t("account_settings")}</h1>

        <div className="vi-card p-6 space-y-5">
          <h2 className="text-lg font-heading font-bold vi-text">{tc("avatar_section_title")}</h2>
          <AvatarUploader
            currentAvatarUrl={avatarUrl}
            userName={profileName || user.name}
            accessToken={accessToken}
            onChange={(newUrl) => setAvatarUrl(newUrl)}
          />
        </div>

        <div className="vi-card p-6 space-y-5">
          <h2 className="text-lg font-heading font-bold vi-text">{t("profile_information")}</h2>
          {profileMsg && (
            <p className="text-sm text-[hsl(var(--visual-science))] bg-[hsl(var(--visual-science)/0.12)] p-2 rounded">
              {profileMsg}
            </p>
          )}
          {profileErr && (
            <p className="text-sm text-[hsl(var(--visual-math))] bg-[hsl(var(--visual-math)/0.12)] p-2 rounded">
              {profileErr}
            </p>
          )}
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1">
                {t("full_name")}
              </label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-lg border vi-border bg-[hsl(var(--visual-surface))] focus:border-[hsl(var(--visual-primary))] focus:ring-2 focus:ring-[hsl(var(--visual-primary)/0.2)] outline-none transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1">{tc("email")}</label>
              <input
                type="email"
                value={profileEmail}
                onChange={(e) => setProfileEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-lg border vi-border bg-[hsl(var(--visual-surface))] focus:border-[hsl(var(--visual-primary))] focus:ring-2 focus:ring-[hsl(var(--visual-primary)/0.2)] outline-none transition"
              />
            </div>
            <button
              type="submit"
              disabled={profileLoading}
              className="px-6 py-2.5 rounded-lg bg-[hsl(var(--visual-primary))] text-white font-semibold hover:bg-[hsl(var(--visual-primary)/0.9)] transition disabled:opacity-50 text-sm"
              style={{ minHeight: 44 }}
            >
              {profileLoading ? tc("saving") : tc("save")}
            </button>
          </form>
        </div>

        <div className="vi-card p-6 space-y-5">
          <h2 className="text-lg font-heading font-bold vi-text">{t("change_password")}</h2>
          {pwMsg && (
            <p className="text-sm text-[hsl(var(--visual-science))] bg-[hsl(var(--visual-science)/0.12)] p-2 rounded">
              {pwMsg}
            </p>
          )}
          {pwErr && (
            <p className="text-sm text-[hsl(var(--visual-math))] bg-[hsl(var(--visual-math)/0.12)] p-2 rounded">
              {pwErr}
            </p>
          )}
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1">
                {t("current_password")}
              </label>
              <input
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-lg border vi-border bg-[hsl(var(--visual-surface))] focus:border-[hsl(var(--visual-primary))] focus:ring-2 focus:ring-[hsl(var(--visual-primary)/0.2)] outline-none transition"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">
                  {t("new_password")}
                </label>
                <input
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-2.5 rounded-lg border vi-border bg-[hsl(var(--visual-surface))] focus:border-[hsl(var(--visual-primary))] focus:ring-2 focus:ring-[hsl(var(--visual-primary)/0.2)] outline-none transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">
                  {t("confirm_new_password")}
                </label>
                <input
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-2.5 rounded-lg border vi-border bg-[hsl(var(--visual-surface))] focus:border-[hsl(var(--visual-primary))] focus:ring-2 focus:ring-[hsl(var(--visual-primary)/0.2)] outline-none transition"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={pwLoading}
              className="px-6 py-2.5 rounded-lg bg-[hsl(var(--visual-primary))] text-white font-semibold hover:bg-[hsl(var(--visual-primary)/0.9)] transition disabled:opacity-50 text-sm"
              style={{ minHeight: 44 }}
            >
              {pwLoading ? t("changing") : t("change_password")}
            </button>
          </form>
        </div>

        <MfaSettings accentColor="violet" />

        <div className="vi-card p-6 space-y-5">
          <h2 className="text-lg font-heading font-bold vi-text">
            {t("notification_preferences")}
          </h2>
          {notifMsg && (
            <p className="text-sm text-[hsl(var(--visual-science))] bg-[hsl(var(--visual-science)/0.12)] p-2 rounded">
              {notifMsg}
            </p>
          )}
          <div className="space-y-4">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-800">{t("email_notifications")}</h3>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={notifPrefs.emailEnabled}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, emailEnabled: e.target.checked })}
                  className="w-4 h-4 rounded vi-border text-[hsl(var(--visual-primary))] focus:ring-[hsl(var(--visual-primary))]"
                />
                <span className="text-sm vi-text-muted">{t("enable_email")}</span>
              </label>
              <div className="ml-7">
                <label className="block text-xs vi-text-muted mb-1">{t("digest_frequency")}</label>
                <select
                  value={notifPrefs.emailDigest}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, emailDigest: e.target.value })}
                  className="px-3 py-1.5 rounded border vi-border bg-[hsl(var(--visual-surface))] text-sm"
                >
                  <option value="realtime">{t("realtime")}</option>
                  <option value="daily">{t("daily")}</option>
                  <option value="weekly">{t("weekly")}</option>
                </select>
              </div>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={notifPrefs.emailMarketing}
                  onChange={(e) =>
                    setNotifPrefs({ ...notifPrefs, emailMarketing: e.target.checked })
                  }
                  className="w-4 h-4 rounded vi-border text-[hsl(var(--visual-primary))] focus:ring-[hsl(var(--visual-primary))]"
                />
                <span className="text-sm vi-text-muted">{t("product_updates")}</span>
              </label>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-800">{t("push_notifications")}</h3>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={notifPrefs.pushEnabled}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, pushEnabled: e.target.checked })}
                  className="w-4 h-4 rounded vi-border text-[hsl(var(--visual-primary))] focus:ring-[hsl(var(--visual-primary))]"
                />
                <span className="text-sm vi-text-muted">{t("enable_push")}</span>
              </label>
              <label className="flex items-center gap-3 ml-7">
                <input
                  type="checkbox"
                  checked={notifPrefs.pushSessionReminders}
                  onChange={(e) =>
                    setNotifPrefs({ ...notifPrefs, pushSessionReminders: e.target.checked })
                  }
                  className="w-4 h-4 rounded vi-border text-[hsl(var(--visual-primary))] focus:ring-[hsl(var(--visual-primary))]"
                />
                <span className="text-sm vi-text-muted">{t("session_reminders")}</span>
              </label>
              <label className="flex items-center gap-3 ml-7">
                <input
                  type="checkbox"
                  checked={notifPrefs.pushProgressUpdates}
                  onChange={(e) =>
                    setNotifPrefs({ ...notifPrefs, pushProgressUpdates: e.target.checked })
                  }
                  className="w-4 h-4 rounded vi-border text-[hsl(var(--visual-primary))] focus:ring-[hsl(var(--visual-primary))]"
                />
                <span className="text-sm vi-text-muted">{t("progress_updates")}</span>
              </label>
            </div>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={notifPrefs.smsEnabled}
                onChange={(e) => setNotifPrefs({ ...notifPrefs, smsEnabled: e.target.checked })}
                className="w-4 h-4 rounded vi-border text-[hsl(var(--visual-primary))] focus:ring-[hsl(var(--visual-primary))]"
              />
              <span className="text-sm vi-text-muted">{t("sms_notifications")}</span>
            </label>
            <button
              onClick={handleNotifSave}
              className="px-6 py-2.5 rounded-lg bg-[hsl(var(--visual-primary))] text-white font-semibold hover:bg-[hsl(var(--visual-primary)/0.9)] transition text-sm"
              style={{ minHeight: 44 }}
            >
              {t("save_preferences")}
            </button>
          </div>
        </div>

        <div className="vi-card p-6 space-y-5">
          <h2 className="text-lg font-heading font-bold vi-text">{t("data_privacy")}</h2>
          <p className="text-sm vi-text-muted">{t("data_privacy_desc")}</p>

          {deleteLearnerMsg && (
            <p className="text-sm text-[hsl(var(--visual-science))] bg-[hsl(var(--visual-science)/0.12)] p-2 rounded">
              {deleteLearnerMsg}
            </p>
          )}

          {learners.length > 0 ? (
            <div className="space-y-3">
              {learners.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between p-3 rounded-lg vi-surface-soft border vi-border"
                >
                  <span className="font-medium text-sm text-slate-800">{l.name}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDownloadData(l.id)}
                      className="px-3 py-1.5 text-xs rounded-lg bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))] font-semibold hover:bg-[hsl(var(--visual-reading)/0.2)] transition"
                    >
                      {t("download_data")}
                    </button>
                    <button
                      onClick={() => {
                        setDeleteLearnerId(l.id);
                        setDeleteLearnerConfirm("");
                        setDeleteLearnerMsg("");
                      }}
                      className="px-3 py-1.5 text-xs rounded-lg bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))] font-semibold hover:bg-[hsl(var(--visual-math)/0.2)] transition"
                    >
                      {t("remove_learner")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm vi-text-muted">{t("no_learners_found")}</p>
          )}

          {deleteLearnerId && (
            <div className="p-4 rounded-lg bg-[hsl(var(--visual-math)/0.06)] border border-[hsl(var(--visual-math)/0.3)] space-y-3">
              <p className="text-sm text-[hsl(var(--visual-math))] font-medium">
                {t("confirm_remove_learner", {
                  name: learners.find((l) => l.id === deleteLearnerId)?.name || "",
                })}
              </p>
              <input
                type="text"
                value={deleteLearnerConfirm}
                onChange={(e) => setDeleteLearnerConfirm(e.target.value)}
                placeholder={t("type_name_confirm")}
                className="w-full px-4 py-2 rounded-lg border border-[hsl(var(--visual-math)/0.3)] bg-[hsl(var(--visual-surface))] text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteLearner}
                  className="px-4 py-2 text-xs rounded-lg bg-[hsl(var(--visual-math))] text-white font-semibold hover:bg-[hsl(var(--visual-math)/0.9)] transition"
                  style={{ minHeight: 44 }}
                >
                  {t("permanently_remove")}
                </button>
                <button
                  onClick={() => setDeleteLearnerId(null)}
                  className="px-4 py-2 text-xs rounded-lg vi-surface-soft vi-text font-semibold hover:bg-[hsl(var(--visual-border))] transition"
                  style={{ minHeight: 44 }}
                >
                  {tc("cancel")}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="vi-card p-6 border-[hsl(var(--visual-math)/0.3)] space-y-4">
          <h2 className="text-lg font-heading font-bold text-[hsl(var(--visual-math))]">
            {t("danger_zone")}
          </h2>
          <p className="text-sm vi-text-muted">{t("delete_account_desc")}</p>

          {!showDeleteAccount ? (
            <button
              onClick={() => setShowDeleteAccount(true)}
              className="px-6 py-2.5 rounded-lg border-2 border-[hsl(var(--visual-math)/0.3)] text-[hsl(var(--visual-math))] font-semibold hover:bg-[hsl(var(--visual-math)/0.06)] transition text-sm"
              style={{ minHeight: 44 }}
            >
              {t("delete_my_account")}
            </button>
          ) : (
            <div className="p-4 rounded-lg bg-[hsl(var(--visual-math)/0.06)] border border-[hsl(var(--visual-math)/0.3)] space-y-3">
              <p className="text-sm text-[hsl(var(--visual-math))] font-medium">
                {t("delete_account_confirm")}
              </p>
              {deleteAccErr && (
                <p className="text-sm text-[hsl(var(--visual-math))] bg-[hsl(var(--visual-math)/0.12)] p-2 rounded">
                  {deleteAccErr}
                </p>
              )}
              <input
                type="password"
                value={deleteAccPw}
                onChange={(e) => setDeleteAccPw(e.target.value)}
                placeholder={t("enter_password")}
                className="w-full px-4 py-2 rounded-lg border border-[hsl(var(--visual-math)/0.3)] bg-[hsl(var(--visual-surface))] text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteAccLoading || !deleteAccPw}
                  className="px-4 py-2 text-xs rounded-lg bg-[hsl(var(--visual-math))] text-white font-semibold hover:bg-[hsl(var(--visual-math)/0.9)] transition disabled:opacity-50"
                  style={{ minHeight: 44 }}
                >
                  {deleteAccLoading ? t("deleting") : t("permanently_delete")}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteAccount(false);
                    setDeleteAccPw("");
                    setDeleteAccErr("");
                  }}
                  className="px-4 py-2 text-xs rounded-lg vi-surface-soft vi-text font-semibold hover:bg-[hsl(var(--visual-border))] transition"
                  style={{ minHeight: 44 }}
                >
                  {tc("cancel")}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
