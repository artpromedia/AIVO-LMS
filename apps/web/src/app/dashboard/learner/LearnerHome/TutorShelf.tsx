"use client";
import Image from "next/image";
import { getTutorsForTier } from "@aivo/brand";
import { useFlVariant, useTierThemeOptional } from "@aivo/learner-ui";
import { useTranslations } from "next-intl";
import { useAuth } from "@/providers/auth-provider";
import { useLearnerEntitlements } from "@/hooks/useLearnerEntitlements";

interface TutorShelfProps {
  onSelectTutor: (tutorKey: string) => void;
  recentTutorKey?: string;
}

export function TutorShelf({ onSelectTutor, recentTutorKey }: TutorShelfProps) {
  const { profile, isLow, isPreSymbolic } = useFlVariant();
  const tierCtx = useTierThemeOptional();
  const t = useTranslations("learner");
  const { user, accessToken } = useAuth();
  const { isTutorEntitled } = useLearnerEntitlements({
    tenantId: user?.tenantId,
    accessToken,
  });
  // Filter tutors by the learner's age tier — Chrono / Lingua / Forge /
  // Compass are hidden for K-5 because they aren't curricular fits there.
  const allTutors = getTutorsForTier(tierCtx?.theme.id ?? null);

  if (isPreSymbolic) return null;

  const visibleTutors = (() => {
    switch (profile.tutorShelfMode) {
      case "scroll": return allTutors;
      case "paged": return allTutors.slice(0, 6);
      case "limited": return allTutors.slice(0, 4);
      case "single": return recentTutorKey ? allTutors.filter(([k]) => k === recentTutorKey).slice(0, 1) : allTutors.slice(0, 1);
      default: return allTutors;
    }
  })();

  const sortedTutors = recentTutorKey
    ? [...visibleTutors.filter(([k]) => k === recentTutorKey), ...visibleTutors.filter(([k]) => k !== recentTutorKey)]
    : visibleTutors;

  return (
    <section className="px-4 md:px-8" aria-label={t("tutors_shelf_label")}>
      <h2 className={`font-extrabold text-slate-900 mb-4 ${isLow ? "text-2xl text-center" : "text-lg"}`}>
        {isLow ? t("pick_a_friend") : t("your_tutors")}
      </h2>
      <div
        className={`flex gap-4 pb-2 ${
          profile.tutorShelfMode === "scroll" ? "overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200" : "flex-wrap justify-center"
        }`}
      >
        {sortedTutors.map(([key, tutor]) => {
          const entitled = isTutorEntitled(key);
          return (
            <button
              key={key}
              onClick={() => onSelectTutor(key)}
              aria-label={
                entitled
                  ? `${tutor.name}, ${tutor.domain}`
                  : t("tutor_locked_label", { name: tutor.name })
              }
              aria-disabled={!entitled}
              data-locked={!entitled || undefined}
              className={`
                flex-shrink-0 flex flex-col items-center gap-2 vi-card border-2 border-transparent
                hover:shadow-lg transition-all group relative
                focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2
                ${isLow ? "p-6 w-36" : "p-4 w-28"}
                ${!entitled ? "opacity-60" : ""}
              `}
              style={{
                transitionDuration: "var(--learner-motion-ms, 300ms)",
                ["--tw-ring-color" as string]: tutor.color,
              } as React.CSSProperties}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = tutor.color)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "transparent")}
            >
              {!entitled && (
                <span
                  className={`absolute top-1 right-1 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide bg-slate-200 text-slate-700 ${isLow ? "text-[11px] px-2 py-1" : ""}`}
                  aria-hidden="true"
                >
                  {t("locked")}
                </span>
              )}
              <div
                className={`relative rounded-3xl overflow-hidden shadow-sm group-hover:scale-110 transition-transform border-4 ${isLow ? "w-20 h-20" : "w-14 h-14"} ${!entitled ? "grayscale" : ""}`}
                style={{ borderColor: tutor.color }}
              >
                <Image src={tutor.avatar} alt={`${tutor.name} — ${tutor.domain}`} fill className="object-cover object-top" sizes={isLow ? "80px" : "56px"} />
              </div>
              <span className={`font-extrabold ${isLow ? "text-lg" : "text-sm"}`} style={{ color: tutor.color }}>
                {tutor.name}
              </span>
              {!isLow && (
                <span className="text-[11px] text-slate-500 font-semibold text-center leading-tight">{tutor.domain}</span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
