"use client";
import Image from "next/image";
import { getTutorsForTier } from "@aivo/brand";
import { SkipLink, useTierThemeOptional } from "@aivo/learner-ui";
import { useTranslations } from "next-intl";

interface PreSymbolicViewProps {
  userName: string;
  totalXp: number;
  xpPercent: number;
  onLogout: () => void;
  onSelectTutor: (tutorKey: string) => void;
}

export function PreSymbolicView({
  userName,
  totalXp,
  xpPercent,
  onLogout,
  onSelectTutor,
}: PreSymbolicViewProps) {
  const tierCtx = useTierThemeOptional();
  const allTutors = getTutorsForTier(tierCtx?.theme.id ?? null).slice(0, 4);
  const t = useTranslations("learner");
  const tc = useTranslations("common");

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-pink-50">
      <SkipLink />
      <header
        className="bg-white/80 backdrop-blur border-b border-slate-200 px-8 py-4 flex items-center justify-between"
        role="banner"
      >
        <Image
          src="/images/aivo-logo-purple.png"
          alt="AIVO"
          width={100}
          height={30}
          style={{ height: "auto" }}
        />
        <div className="flex items-center gap-4">
          <span className="text-lg font-heading font-bold text-primary">{userName}</span>
          <button
            onClick={onLogout}
            aria-label={tc("logout")}
            className="text-sm text-slate-500 hover:text-red-500 font-semibold"
          >
            {tc("logout")}
          </button>
        </div>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className="max-w-3xl mx-auto px-8 py-12 text-center space-y-8"
      >
        <div className="text-6xl" aria-hidden="true">
          ⭐
        </div>
        <h1 className="text-3xl font-heading font-bold text-slate-900">
          {t("presymbolic_welcome", { userName })}
        </h1>
        <p className="text-lg text-slate-500 font-semibold">{t("parent_managed_learning")}</p>

        <div className="bg-white rounded-3xl p-8 border border-yellow-200 shadow-sm">
          <div className="text-5xl mb-3" aria-hidden="true">
            ⭐
          </div>
          <div className="text-2xl font-heading font-bold text-amber-600">
            {t("stars_count", { count: totalXp })}
          </div>
          <div className="mt-4 bg-yellow-100 rounded-full h-4 overflow-hidden max-w-xs mx-auto">
            <div
              className="bg-gradient-to-r from-yellow-400 to-amber-500 h-full rounded-full transition-all"
              style={{ width: `${xpPercent}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {allTutors.map(([key, tutor]) => (
            <button
              key={key}
              onClick={() => onSelectTutor(key)}
              className="bg-white rounded-3xl p-8 shadow-sm border-4 hover:shadow-xl transition text-center focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2"
              style={{ borderColor: tutor.color, minHeight: "var(--learner-hit-target, 96px)" }}
            >
              <div
                className="relative w-24 h-24 mx-auto rounded-full overflow-hidden shadow-lg"
                style={{ borderColor: tutor.color, borderWidth: "4px" }}
              >
                <Image
                  src={tutor.avatar}
                  alt={tutor.name}
                  fill
                  className="object-cover object-top"
                  sizes="96px"
                />
              </div>
              <div className="font-heading font-bold text-xl mt-3" style={{ color: tutor.color }}>
                {tutor.name}
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
