"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { TenantFeatureOverrides, TenantNotificationPrefs } from "@/lib/db/types";

type Initial = {
  notifications: TenantNotificationPrefs;
  features: TenantFeatureOverrides;
};

type NKey = keyof TenantNotificationPrefs;
type FKey = keyof TenantFeatureOverrides;

const NOTIFICATION_ROWS: Array<{ key: NKey; title: string; desc: string }> = [
  {
    key: "weeklyDigestEmail",
    title: "Weekly digest email",
    desc: "Send a Monday-morning roll-up of learner activity to every district admin.",
  },
  {
    key: "incidentAlertsEmail",
    title: "Incident alerts",
    desc: "Email district admins whenever a P1/P2 incident is opened in Status.",
  },
  {
    key: "rosterDriftEmail",
    title: "Roster drift alerts",
    desc: "Notify when SIS sync introduces unexpected adds, removes, or grade jumps.",
  },
  {
    key: "complianceRemindersEmail",
    title: "Compliance reminders",
    desc: "Annual COPPA/FERPA renewal and DPA acknowledgement nudges.",
  },
];

const FEATURE_ROWS: Array<{ key: FKey; title: string; desc: string }> = [
  {
    key: "homeworkHelpEnabled",
    title: "Homework help",
    desc: "Allow learners to start a tutored homework session from the Today screen.",
  },
  {
    key: "parentIepUploadEnabled",
    title: "Parent IEP upload",
    desc: "Permit families to upload IEP documents directly through the parent portal.",
  },
  {
    key: "rewardsShopEnabled",
    title: "Rewards shop",
    desc: "Show the avatar shop and virtual currency to district learners.",
  },
  {
    key: "discoveryAdventureEnabled",
    title: "Discovery Adventure baseline",
    desc: "Run the 6-chapter immersive baseline assessment on first sign-in.",
  },
];

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aivo-primary ${
        checked ? "bg-aivo-primary" : "bg-aivo-border"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export function SettingsTogglesForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const t = useTranslations("admin.district_settings");
  const [notifications, setNotifications] = useState(initial.notifications);
  const [features, setFeatures] = useState(initial.features);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<
    { kind: "ok"; msg: string } | { kind: "err"; msg: string } | null
  >(null);

  const dirty =
    JSON.stringify(notifications) !== JSON.stringify(initial.notifications) ||
    JSON.stringify(features) !== JSON.stringify(initial.features);

  function save() {
    setStatus(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/bff/admin/district/settings", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ notifications, features }),
        });
        const json = await res.json();
        if (!json.ok) {
          setStatus({
            kind: "err",
            msg: json.error?.userMessage ?? "Could not save changes.",
          });
          return;
        }
        setStatus({ kind: "ok", msg: "Saved." });
        router.refresh();
      } catch {
        setStatus({ kind: "err", msg: "Network error — please try again." });
      }
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-[var(--aivo-density-card-pad)]">
        <p className="font-display text-lg font-semibold">{t("notifications_heading")}</p>
        <p className="text-sm text-aivo-ink-soft">{t("notifications_desc")}</p>
        <ul className="mt-4 divide-y divide-aivo-border">
          {NOTIFICATION_ROWS.map((row) => (
            <li key={row.key} className="flex items-start justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-medium">{row.title}</p>
                <p className="text-xs text-aivo-ink-soft">{row.desc}</p>
              </div>
              <Toggle
                label={row.title}
                checked={notifications[row.key]}
                onChange={(v) => setNotifications((prev) => ({ ...prev, [row.key]: v }))}
              />
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-[var(--aivo-density-card-pad)]">
        <p className="font-display text-lg font-semibold">{t("features_heading")}</p>
        <p className="text-sm text-aivo-ink-soft">
          {t("features_desc")}
        </p>
        <ul className="mt-4 divide-y divide-aivo-border">
          {FEATURE_ROWS.map((row) => (
            <li key={row.key} className="flex items-start justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-medium">{row.title}</p>
                <p className="text-xs text-aivo-ink-soft">{row.desc}</p>
              </div>
              <Toggle
                label={row.title}
                checked={features[row.key]}
                onChange={(v) => setFeatures((prev) => ({ ...prev, [row.key]: v }))}
              />
            </li>
          ))}
        </ul>
      </Card>

      <div className="lg:col-span-2 flex items-center justify-end gap-3">
        {status?.kind === "ok" ? <p className="text-sm text-aivo-success">{status.msg}</p> : null}
        {status?.kind === "err" ? <p className="text-sm text-aivo-danger">{status.msg}</p> : null}
        <Button type="button" onClick={save} disabled={!dirty || pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
