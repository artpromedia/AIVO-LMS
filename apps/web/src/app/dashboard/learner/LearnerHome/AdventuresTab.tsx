"use client";
import {
  Map,
  Calculator,
  BookOpen,
  Beaker,
  Hourglass,
  Code2,
  ChevronRight,
  Swords,
  Camera,
} from "lucide-react";
import { TUTORS, getTutorsForTier } from "@aivo/brand";
import { useFlVariant, LearnerCard, useTierThemeOptional } from "@aivo/learner-ui";
import { useTranslations } from "next-intl";

interface AdventuresTabProps {
  onNavigate: (path: string) => void;
}

const QUEST_WORLDS = [
  { nameKey: "world_mathlands", Icon: Calculator, tutor: "nova", slug: "nova" },
  { nameKey: "world_word", Icon: BookOpen, tutor: "sage", slug: "sage" },
  { nameKey: "world_science", Icon: Beaker, tutor: "spark", slug: "spark" },
  { nameKey: "world_time", Icon: Hourglass, tutor: "chrono", slug: "chrono" },
  { nameKey: "world_code", Icon: Code2, tutor: "pixel", slug: "pixel" },
] as const;

export function AdventuresTab({ onNavigate }: AdventuresTabProps) {
  const { isLow } = useFlVariant();
  const tierCtx = useTierThemeOptional();
  const t = useTranslations("learner");

  // Hide quest worlds whose tutor isn't curricular for this learner's tier
  // (e.g. Chrono / world_time is removed for K-5 EARLY learners).
  const allowedTutorKeys = new Set(getTutorsForTier(tierCtx?.theme.id ?? null).map(([k]) => k));
  const visibleQuests = QUEST_WORLDS.filter((w) => allowedTutorKeys.has(w.tutor));

  return (
    <div className="space-y-6">
      <LearnerCard>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]">
            <Map className="w-5 h-5" strokeWidth={2.5} aria-hidden />
          </div>
          <h3 className="font-extrabold text-slate-900">
            {isLow ? t("adventures_title_simple") : t("quest_worlds_title")}
          </h3>
        </div>
        <div className="space-y-2">
          {visibleQuests.slice(0, isLow ? 3 : 5).map((world) => {
            const tutor = TUTORS[world.tutor as keyof typeof TUTORS];
            // eslint-disable-next-line no-restricted-syntax -- per-tutor brand color fallback; tutor.color is brand-mark, not surface token
            const color = tutor?.color || "#7C3AED";
            const Icon = world.Icon;
            return (
              <button
                key={world.slug}
                onClick={() => onNavigate(`/dashboard/learner/quests/${world.slug}`)}
                className="w-full flex items-center gap-3 bg-slate-50 hover:bg-white rounded-2xl px-4 py-3 border border-slate-100 hover:border-[hsl(var(--visual-primary)/0.3)] transition-all text-left group focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--visual-primary))]"
                style={{ minHeight: "var(--learner-hit-target, 56px)" }}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${color}1f`, color }}
                  aria-hidden
                >
                  <Icon className="w-6 h-6" strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-extrabold text-slate-900">{t(world.nameKey)}</p>
                  <p className="text-xs text-slate-500 font-semibold">{t("explore_quests")}</p>
                </div>
                <ChevronRight
                  className="w-5 h-5 text-slate-300 group-hover:text-[hsl(var(--visual-primary))] transition-colors"
                  aria-hidden
                />
              </button>
            );
          })}
        </div>
      </LearnerCard>

      {!isLow && (
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={() => onNavigate("/dashboard/learner/challenges")}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[hsl(var(--visual-math)/0.1)] text-[hsl(var(--visual-math))] font-extrabold text-sm hover:bg-[hsl(var(--visual-math)/0.16)] transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--visual-math))]"
            style={{ minHeight: "var(--learner-hit-target, 40px)" }}
          >
            <Swords className="w-4 h-4" strokeWidth={2.5} aria-hidden /> {t("challenges")}
          </button>
          <button
            onClick={() => onNavigate("/dashboard/learner/homework")}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] font-extrabold text-sm hover:bg-[hsl(var(--visual-primary)/0.18)] transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--visual-primary))]"
            style={{ minHeight: "var(--learner-hit-target, 40px)" }}
          >
            <Camera className="w-4 h-4" strokeWidth={2.5} aria-hidden /> {t("homework_helper")}
          </button>
        </div>
      )}
    </div>
  );
}
