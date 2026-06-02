"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Clock, Sparkles, AlertTriangle } from "lucide-react";

interface TodCell {
  timeOfDay: string;
  meanAccuracy: number;
}
interface FitCell {
  subject: string;
  modality: string;
  meanAccuracy: number;
}
interface Hotspot {
  subject: string;
  modality: string;
  meanFrustration: number;
}
interface Insights {
  windowDays: number;
  totalSessions: number;
  bestWindow: TodCell | null;
  modalityFit: FitCell[];
  frustrationHotspots: Hotspot[];
}

/**
 * Parent "What's Working" panel — surfaces the three IEP-ready signals
 * (best learning window, modality that clicks, where frustration spikes)
 * from `/api/bff/parent/learners/:id/whats-working` (dual-path family-svc).
 */
export function WhatsWorkingPanel({
  learnerId,
  learnerName,
}: {
  learnerId: string;
  learnerName: string;
}) {
  const t = useTranslations("parent.whats_working");
  const [windowDays, setWindowDays] = React.useState(30);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<Insights | null>(null);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetch(`/api/bff/parent/learners/${learnerId}/whats-working?windowDays=${windowDays}`)
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j?.data) setData(j.data as Insights);
        else setError(t("load_error"));
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
  }, [learnerId, windowDays, t]);

  const pct = (n: number) => Math.round(n * 100);
  const tod = (key: string) => t(`tod_${key}`);
  const modality = (key: string) => t(`modality_${key}`);

  // Best single modality fit = highest accuracy across all subject×modality cells.
  const topFit =
    data && data.modalityFit.length > 0
      ? [...data.modalityFit].sort((a, b) => b.meanAccuracy - a.meanAccuracy)[0]
      : null;
  const topHotspot = data?.frustrationHotspots[0] ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-aivo-ink-soft">{t("intro", { name: learnerName })}</p>
        <div className="flex items-center gap-1" role="group" aria-label={t("window_label")}>
          {[30, 90].map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWindowDays(w)}
              aria-pressed={windowDays === w}
              className={`rounded-iw-control px-2.5 py-1 text-xs font-medium transition ${
                windowDays === w
                  ? "bg-aivo-accent text-white"
                  : "border border-iw-border text-aivo-ink-soft hover:border-aivo-accent"
              }`}
            >
              {w === 30 ? t("window_30") : t("window_90")}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-aivo-ink-soft">{t("loading")}</p>
      ) : error ? (
        <p role="alert" className="text-sm text-aivo-danger">
          {error}
        </p>
      ) : !data || data.totalSessions === 0 ? (
        <p className="text-sm text-aivo-ink-soft">{t("empty", { name: learnerName })}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <Signal
            Icon={Clock}
            tone="accent"
            label={t("best_window")}
            value={data.bestWindow ? tod(data.bestWindow.timeOfDay) : t("none_yet")}
            sub={
              data.bestWindow
                ? t("accuracy", { pct: pct(data.bestWindow.meanAccuracy) })
                : undefined
            }
          />
          <Signal
            Icon={Sparkles}
            tone="success"
            label={t("modality_fit")}
            value={topFit ? modality(topFit.modality) : t("none_yet")}
            sub={
              topFit
                ? `${t("accuracy", { pct: pct(topFit.meanAccuracy) })} · ${t("in_subject", {
                    subject: topFit.subject,
                  })}`
                : undefined
            }
          />
          <Signal
            Icon={AlertTriangle}
            tone="danger"
            label={t("frustration")}
            value={topHotspot ? topHotspot.subject : t("none_yet")}
            sub={topHotspot ? modality(topHotspot.modality) : undefined}
          />
        </div>
      )}
    </div>
  );
}

function Signal({
  Icon,
  tone,
  label,
  value,
  sub,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  tone: "accent" | "success" | "danger";
  label: string;
  value: string;
  sub?: string;
}) {
  const toneClass =
    tone === "success"
      ? "text-aivo-success"
      : tone === "danger"
        ? "text-aivo-danger"
        : "text-aivo-accent";
  return (
    <div className="rounded-iw-control border border-iw-border p-3.5">
      <Icon className={`h-5 w-5 ${toneClass}`} />
      <p className="mt-2 text-xs font-medium uppercase tracking-wide text-aivo-ink-soft">{label}</p>
      <p className="mt-0.5 font-display text-base font-semibold text-iw-text-strong">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-aivo-ink-soft">{sub}</p> : null}
    </div>
  );
}
