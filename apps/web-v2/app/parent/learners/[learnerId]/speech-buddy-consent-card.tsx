"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

const AGE_BANDS = [
  { value: "3-5", key: "age_3_5" },
  { value: "6-9", key: "age_6_9" },
  { value: "10-12", key: "age_10_12" },
  { value: "13-15", key: "age_13_15" },
] as const;

/**
 * Parent control to grant / revoke Speech Buddy consent for one learner.
 * Talks to `/api/bff/parent/learners/:id/speech-buddy-consent`, which is
 * dual-path (real family-svc when enabled, in-memory store in dev/mock).
 */
export function SpeechBuddyConsentCard({
  learnerId,
  learnerName,
}: {
  learnerId: string;
  learnerName: string;
}) {
  const t = useTranslations("parent.speech_buddy");
  const base = `/api/bff/parent/learners/${learnerId}/speech-buddy-consent`;
  const [loading, setLoading] = React.useState(true);
  const [granted, setGranted] = React.useState(false);
  const [grantedBand, setGrantedBand] = React.useState<string | null>(null);
  const [ageBand, setAgeBand] = React.useState<string>("6-9");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    let alive = true;
    fetch(base)
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        const data = j?.data;
        if (data) {
          setGranted(Boolean(data.granted));
          if (data.consent?.ageBand) {
            setGrantedBand(data.consent.ageBand);
            setAgeBand(data.consent.ageBand);
          }
        }
      })
      .catch(() => {
        if (alive) setError(t("load_error"));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [base, t]);

  function grant() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(base, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ageBand }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j?.error?.message ?? t("save_error"));
        return;
      }
      setGranted(true);
      setGrantedBand(ageBand);
    });
  }

  function revoke() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(base, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j?.error?.message ?? t("revoke_error"));
        return;
      }
      setGranted(false);
      setGrantedBand(null);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-iw-text-muted">{t("intro", { name: learnerName })}</p>

      {loading ? (
        <p className="text-sm text-iw-text-muted">{t("loading")}</p>
      ) : granted ? (
        <div className="flex flex-col gap-3">
          <div
            role="status"
            className="rounded-iw-control border border-iw-success/40 bg-iw-success/10 px-3.5 py-2.5 text-sm text-iw-text-strong"
          >
            {grantedBand
              ? t("enabled_band", { band: grantedBand.replace("-", "–") })
              : t("enabled")}
          </div>
          <div>
            <Button variant="outline" size="sm" disabled={pending} onClick={revoke}>
              {pending ? t("working") : t("withdraw")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="sb-age-band" className="text-sm font-medium text-iw-text-strong">
              {t("age_band_label")}
            </label>
            <select
              id="sb-age-band"
              value={ageBand}
              onChange={(e) => setAgeBand(e.target.value)}
              className="h-12 px-3 rounded-iw-control bg-white border border-iw-border text-base text-iw-text-strong focus:border-[var(--aivo-sensory-primary)] focus:ring-2 focus:ring-[var(--aivo-sensory-primary)]/20 outline-none"
            >
              {AGE_BANDS.map((b) => (
                <option key={b.value} value={b.value}>
                  {t(b.key)}
                </option>
              ))}
            </select>
            <p className="text-xs text-iw-text-muted">{t("age_band_help")}</p>
          </div>
          <div>
            <Button size="sm" disabled={pending} onClick={grant}>
              {pending ? t("working") : t("enable")}
            </Button>
          </div>
        </div>
      )}

      {error ? (
        <p role="alert" className="text-sm text-iw-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
