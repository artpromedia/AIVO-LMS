"use client";
import { useTranslations } from "next-intl";
import { Sparkles, RefreshCw, Zap, Layers, Network, Brain } from "lucide-react";

const BRAIN_FEATURES = [
  { Icon: RefreshCw, titleKey: "f1_title" as const, descKey: "f1_desc" as const },
  { Icon: Zap, titleKey: "f2_title" as const, descKey: "f2_desc" as const },
  { Icon: Layers, titleKey: "f3_title" as const, descKey: "f3_desc" as const },
  { Icon: Network, titleKey: "f4_title" as const, descKey: "f4_desc" as const },
];

const METRICS = [
  { labelKey: "metric_math" as const, value: 78, color: "bg-iw-purple-500" },
  { labelKey: "metric_reading" as const, value: 64, color: "bg-iw-success" },
  { labelKey: "metric_sensory" as const, value: 92, color: "bg-iw-warm" },
  { labelKey: "metric_social" as const, value: 71, color: "bg-iw-primary" },
];

export function BrainClone() {
  const t = useTranslations("marketing.brain_clone");

  return (
    <section className="py-24 bg-gradient-to-br from-primary via-iw-purple-700 to-primary-dark relative overflow-hidden text-white">
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-10 right-20 w-64 h-64 bg-iw-warm rounded-full blur-3xl animate-blob motion-reduce:animate-none" />
        <div
          className="absolute bottom-10 left-20 w-72 h-72 bg-iw-accent rounded-full blur-3xl animate-blob motion-reduce:animate-none"
          style={{ animationDelay: "6s" }}
        />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 md:px-8 grid md:grid-cols-2 gap-12 items-center">
        <div className="space-y-6">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 text-white font-bold text-sm backdrop-blur">
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            {t("label")}
          </span>
          <h2 className="text-4xl md:text-5xl font-heading font-bold leading-tight">
            {t("title")}
          </h2>
          <p className="text-lg text-white/85 font-body leading-relaxed">{t("subtitle")}</p>
          <div className="grid sm:grid-cols-2 gap-4 pt-2">
            {BRAIN_FEATURES.map((f) => (
              <div key={f.titleKey} className="flex gap-3">
                <div className="w-10 h-10 rounded-iw-control bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
                  <f.Icon className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-heading font-bold text-base mb-1">{t(f.titleKey)}</p>
                  <p className="text-sm text-white/75 font-body leading-relaxed">{t(f.descKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="bg-white rounded-iw-card-lg p-8 shadow-soft-5 text-iw-ink animate-float-slow motion-reduce:animate-none">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-iw-control bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white">
                <Brain className="w-6 h-6" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-bold text-iw-ink-muted uppercase tracking-wider">
                  {t("demo_label")}
                </p>
                <p className="font-heading font-bold text-lg">{t("demo_name")}</p>
              </div>
              <span className="ml-auto inline-flex items-center px-3 py-1 rounded-iw-chip bg-iw-success-subtle text-iw-success-strong font-bold text-xs">
                {t("demo_live")}
              </span>
            </div>
            <div className="space-y-4">
              {METRICS.map((m) => (
                <div key={m.labelKey}>
                  <div className="flex justify-between text-sm font-bold text-iw-ink mb-1.5">
                    <span>{t(m.labelKey)}</span>
                    <span>{m.value}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-iw-raised overflow-hidden">
                    <div
                      className={`h-full ${m.color} rounded-full`}
                      style={{ width: `${m.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-5 border-t border-iw-border flex items-center gap-3 text-sm">
              <div className="w-2 h-2 rounded-full bg-iw-success animate-pulse motion-reduce:animate-none" />
              <span className="font-bold text-iw-ink">{t("demo_status")}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
