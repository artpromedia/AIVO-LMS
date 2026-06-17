"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { AuthShell, AuthCard, ReassuranceCard, ConsentRow, StepperHeader } from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";
import { useTranslations } from "next-intl";

const STEPS = [
  { label: "about_you" },
  { label: "role" },
  { label: "family" },
  { label: "consent" },
] as const;

/**
 * The parent-facing notification types this step's single "Notifications"
 * toggle governs: weekly progress digests and safety/approval messages. We
 * flip their email channel so the choice maps onto real, persisted
 * `NotificationPreference` state via `PATCH /api/bff/notification-preferences`
 * rather than being silently discarded.
 */
const NOTIF_EMAIL_KEYS = ["parent_progress_summary:email", "safety_review_required:email"] as const;

async function persistNotificationPreference(enabled: boolean): Promise<void> {
  const preferences: Record<string, boolean> = {};
  for (const key of NOTIF_EMAIL_KEYS) preferences[key] = enabled;
  const res = await fetch("/api/bff/notification-preferences", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ preferences }),
  });
  let json: { ok?: boolean } = {};
  try {
    json = (await res.json()) as { ok?: boolean };
  } catch {
    /* ignore — !res.ok branch handles it */
  }
  if (!res.ok || json.ok !== true) {
    throw new Error("notification_prefs_persist_failed");
  }
}

export default function DevicePermissionsPage() {
  const t = useTranslations("onboarding.permissions");
  const tc = useTranslations("onboarding.common");
  const ts = useTranslations("onboarding.steps");
  const router = useRouter();
  // Mic and camera are browser-level device-capability prompts, not server
  // state: the actual grant happens when the browser shows its own permission
  // dialog at point-of-use (speak-to-read, document scan). We keep the toggles
  // as an honest "pre-ask" affordance but never persist them — only the
  // notification preference maps to durable server state.
  const [mic, setMic] = React.useState(false);
  const [cam, setCam] = React.useState(false);
  const [notifs, setNotifs] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleContinue(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await persistNotificationPreference(notifs);
      router.push("/onboarding/pin");
    } catch {
      setError(t("save_error"));
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <div className="flex flex-col gap-5">
        <StepperHeader steps={STEPS.map((s) => ({ label: ts(s.label) }))} current={3} />
        <AuthCard
          icon={<AivoIcon name="safetyOk" size={32} />}
          eyebrow={t("eyebrow")}
          title={t("title")}
          subtitle={t("subtitle")}
          reassurance={
            <ReassuranceCard tone="safety" title={t("reassure_title")} body={t("reassure_body")} />
          }
          actions={
            <form onSubmit={handleContinue} className="contents">
              <button
                type="submit"
                disabled={submitting}
                aria-disabled={submitting}
                className={`w-full h-12 rounded-iw-control bg-[var(--aivo-sensory-primary)] text-white font-semibold flex items-center justify-center hover:opacity-95 ${
                  submitting ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {submitting ? t("saving") : t("continue")}
              </button>
              {error ? (
                <p role="alert" className="text-xs text-iw-error text-center">
                  {error}
                </p>
              ) : null}
            </form>
          }
        >
          <ConsentRow
            id="p-mic"
            title={t("mic_title")}
            description={t("mic_desc")}
            checked={mic}
            onChange={setMic}
            badge={tc("badge_optional")}
            icon={<AivoIcon name="aiWand" size={18} />}
          />
          <ConsentRow
            id="p-cam"
            title={t("cam_title")}
            description={t("cam_desc")}
            checked={cam}
            onChange={setCam}
            badge={tc("badge_optional")}
            icon={<AivoIcon name="curriculum" size={18} />}
          />
          <ConsentRow
            id="p-notifs"
            title={t("notifs_title")}
            description={t("notifs_desc")}
            checked={notifs}
            onChange={setNotifs}
            badge={tc("badge_recommended")}
            icon={<AivoIcon name="safetyOk" size={18} />}
          />
        </AuthCard>
      </div>
    </AuthShell>
  );
}
