"use client";
import { useTranslations } from "next-intl";
import { Layers, Users, Brain, MapPin, Eye, BarChart3 } from "lucide-react";

export function Features({ scrollY }: { scrollY: number }) {
  const t = useTranslations("marketing.features");

  const FEATURES = [
    {
      Icon: Layers,
      titleKey: "levels_title" as const,
      descKey: "levels_desc" as const,
      iconBg: "bg-iw-purple-100",
      iconColor: "text-iw-primary",
    },
    {
      Icon: Users,
      titleKey: "tutors_title" as const,
      descKey: "tutors_desc" as const,
      iconBg: "bg-iw-accent-soft",
      iconColor: "text-iw-accent",
    },
    {
      Icon: Brain,
      titleKey: "brain_title" as const,
      descKey: "brain_desc" as const,
      iconBg: "bg-iw-warm-soft",
      iconColor: "text-iw-warm",
    },
    {
      Icon: MapPin,
      titleKey: "region_title" as const,
      descKey: "region_desc" as const,
      iconBg: "bg-iw-success-subtle",
      iconColor: "text-iw-success",
    },
    {
      Icon: Eye,
      titleKey: "sensory_title" as const,
      descKey: "sensory_desc" as const,
      iconBg: "bg-iw-purple-100",
      iconColor: "text-iw-primary",
    },
    {
      Icon: BarChart3,
      titleKey: "analytics_title" as const,
      descKey: "analytics_desc" as const,
      iconBg: "bg-iw-purple-100",
      iconColor: "text-iw-primary",
    },
  ];

  return (
    <section className="py-24 bg-iw-raised relative">
      <div
        className="max-w-6xl mx-auto px-6 md:px-8"
        style={{ transform: `translateY(${Math.max(0, scrollY - 300) * -0.03}px)` }}
      >
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <span className="inline-flex items-center px-4 py-1.5 rounded-iw-chip bg-iw-purple-100 text-iw-primary font-bold text-sm mb-4">
            {t("label")}
          </span>
          <h2 className="text-4xl md:text-5xl font-heading font-bold text-iw-ink mb-4 leading-tight">
            {t("title")}
          </h2>
          <p className="text-lg text-iw-ink-muted font-body">{t("subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.titleKey}
              className="bg-white border-2 border-iw-border rounded-iw-card-lg p-7 hover:shadow-soft-5 hover:-translate-y-1 transition-all duration-300"
            >
              <div
                className={`w-14 h-14 ${f.iconBg} ${f.iconColor} rounded-iw-control flex items-center justify-center mb-5`}
              >
                <f.Icon className="w-7 h-7" aria-hidden="true" />
              </div>
              <h3 className="text-xl font-heading font-bold text-iw-ink mb-2">
                {t(f.titleKey)}
              </h3>
              <p className="text-iw-ink-muted leading-relaxed font-body">{t(f.descKey)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
