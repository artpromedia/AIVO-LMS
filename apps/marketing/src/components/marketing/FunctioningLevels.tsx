"use client";
import { MARKETING_ACCENTS } from "@aivo/brand";
import { useTranslations } from "next-intl";

const LEVELS = [
  {
    level: 1,
    icon: "📖",
    color: MARKETING_ACCENTS.purple,
    bg: "from-violet-500 to-purple-600",
    nameKey: "l1_name",
    descKey: "l1_desc",
    f1: "l1_f1",
    f2: "l1_f2",
    f3: "l1_f3",
  },
  {
    level: 2,
    icon: "🤝",
    color: MARKETING_ACCENTS.cyan,
    bg: "from-cyan-500 to-teal-600",
    nameKey: "l2_name",
    descKey: "l2_desc",
    f1: "l2_f1",
    f2: "l2_f2",
    f3: "l2_f3",
  },
  {
    level: 3,
    icon: "🧩",
    color: MARKETING_ACCENTS.amber,
    bg: "from-amber-400 to-orange-500",
    nameKey: "l3_name",
    descKey: "l3_desc",
    f1: "l3_f1",
    f2: "l3_f2",
    f3: "l3_f3",
  },
  {
    level: 4,
    icon: "🎨",
    color: MARKETING_ACCENTS.emerald,
    bg: "from-emerald-500 to-green-600",
    nameKey: "l4_name",
    descKey: "l4_desc",
    f1: "l4_f1",
    f2: "l4_f2",
    f3: "l4_f3",
  },
  {
    level: 5,
    icon: "✨",
    color: MARKETING_ACCENTS.pink,
    bg: "from-pink-500 to-rose-600",
    nameKey: "l5_name",
    descKey: "l5_desc",
    f1: "l5_f1",
    f2: "l5_f2",
    f3: "l5_f3",
  },
] as const;

export function FunctioningLevels() {
  const t = useTranslations("marketing.levels");

  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-white via-purple-50/30 to-white pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6 md:px-8 relative z-10">
        <div className="text-center mb-16">
          <p className="text-sm font-bold text-primary uppercase tracking-widest mb-3">
            {t("label")}
          </p>
          <h2 className="text-4xl md:text-5xl font-heading font-bold text-slate-900 mb-4">
            {t("title")}
          </h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto font-body">{t("subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {LEVELS.map((lvl) => (
            <div
              key={lvl.level}
              className="group relative bg-white rounded-3xl border border-slate-100 p-6 hover:shadow-xl hover:-translate-y-2 transition-all duration-300 overflow-hidden"
            >
              <div
                className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${lvl.bg} opacity-60 group-hover:opacity-100 transition-opacity`}
              />
              <div className="text-center mb-4">
                <div
                  className={`w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br ${lvl.bg} flex items-center justify-center text-2xl shadow-lg group-hover:scale-110 transition-transform`}
                >
                  {lvl.icon}
                </div>
              </div>
              <div className="text-center">
                <p
                  className="text-xs font-bold uppercase tracking-wider mb-1"
                  style={{ color: lvl.color }}
                >
                  {t("level_label", { level: lvl.level })}
                </p>
                <h3 className="text-lg font-heading font-bold text-slate-900 mb-2">
                  {t(lvl.nameKey)}
                </h3>
                <p className="text-sm text-slate-500 font-body mb-4 leading-relaxed">
                  {t(lvl.descKey)}
                </p>
                <ul className="space-y-1.5">
                  {[lvl.f1, lvl.f2, lvl.f3].map((fKey) => (
                    <li
                      key={fKey}
                      className="text-xs text-slate-500 font-body flex items-center gap-1.5 justify-center"
                    >
                      <span
                        className="w-1 h-1 rounded-full flex-shrink-0"
                        style={{ backgroundColor: lvl.color }}
                      />
                      {t(fKey)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
