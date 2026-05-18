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
      iconBg: "bg-violet-100",
      iconColor: "text-violet-600",
    },
    {
      Icon: Users,
      titleKey: "tutors_title" as const,
      descKey: "tutors_desc" as const,
      iconBg: "bg-cyan-100",
      iconColor: "text-cyan-600",
    },
    {
      Icon: Brain,
      titleKey: "brain_title" as const,
      descKey: "brain_desc" as const,
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
    },
    {
      Icon: MapPin,
      titleKey: "region_title" as const,
      descKey: "region_desc" as const,
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
    },
    {
      Icon: Eye,
      titleKey: "sensory_title" as const,
      descKey: "sensory_desc" as const,
      iconBg: "bg-pink-100",
      iconColor: "text-pink-600",
    },
    {
      Icon: BarChart3,
      titleKey: "analytics_title" as const,
      descKey: "analytics_desc" as const,
      iconBg: "bg-indigo-100",
      iconColor: "text-indigo-600",
    },
  ];

  return (
    <section className="py-24 bg-slate-50 relative">
      <div
        className="max-w-6xl mx-auto px-6 md:px-8"
        style={{ transform: `translateY(${Math.max(0, scrollY - 300) * -0.03}px)` }}
      >
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-purple-100 text-purple-700 font-bold text-sm mb-4">
            {t("label")}
          </span>
          <h2 className="text-4xl md:text-5xl font-heading font-bold text-slate-900 mb-4 leading-tight">
            {t("title")}
          </h2>
          <p className="text-lg text-slate-600 font-body">{t("subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.titleKey}
              className="bg-white border-2 border-slate-100 rounded-3xl p-7 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              <div
                className={`w-14 h-14 ${f.iconBg} ${f.iconColor} rounded-2xl flex items-center justify-center mb-5`}
              >
                <f.Icon className="w-7 h-7" aria-hidden="true" />
              </div>
              <h3 className="text-xl font-heading font-bold text-slate-900 mb-2">
                {t(f.titleKey)}
              </h3>
              <p className="text-slate-600 leading-relaxed font-body">{t(f.descKey)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
