"use client";
import { Target } from "lucide-react";
import { TUTORS } from "@aivo/brand";
import { useFlVariant, LearnerCard } from "@aivo/learner-ui";
import { useTranslations } from "next-intl";
import { SelCheckIn } from "./SelCheckIn";

interface SelExercise {
  title: string;
  steps: string[];
  durationMinutes: number;
}
interface DailyMission {
  id: string;
  title: string;
  tutorKey: string;
  progress: number;
  target: number;
  xpReward: number;
}
interface TodayTabProps {
  missions: DailyMission[];
  onSelCheckin: (emotion: string) => Promise<SelExercise | null>;
}

export function TodayTab({ missions, onSelCheckin }: TodayTabProps) {
  const { isLow } = useFlVariant();
  const t = useTranslations("learner");

  return (
    <div className="space-y-6">
      <SelCheckIn onCheckin={onSelCheckin} />

      {!isLow && missions.length > 0 && (
        <LearnerCard>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[hsl(var(--visual-sel)/0.16)] text-[hsl(var(--visual-sel))]">
              <Target className="w-5 h-5" strokeWidth={2.5} aria-hidden />
            </div>
            <h3 className="font-extrabold text-slate-900">{t("missions_title")}</h3>
          </div>
          <div className="space-y-3">
            {missions.map((mission) => {
              const tutor = TUTORS[mission.tutorKey as keyof typeof TUTORS];
              const percent = mission.target > 0 ? (mission.progress / mission.target) * 100 : 0;
              return (
                <div
                  key={mission.id}
                  className="flex items-center gap-3 bg-slate-50 rounded-2xl px-4 py-3 border border-slate-100"
                >
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0"
                    style={{
                      // eslint-disable-next-line no-restricted-syntax -- tutor brand-mark tint; neutral slate fallback when no tutor assigned
                      backgroundColor: tutor ? `${tutor.color}1f` : "#f1f5f9",
                      color: tutor?.color,
                    }}
                    aria-hidden
                  >
                    {tutor?.icon || <Target className="w-5 h-5" strokeWidth={2.5} aria-hidden />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-extrabold text-slate-900 truncate">
                      {mission.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 max-w-[140px] bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-2 rounded-full bg-[hsl(var(--visual-sel))] transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 font-bold">
                        {mission.progress}/{mission.target}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-extrabold text-[hsl(var(--visual-sel))] shrink-0">
                    {t("xp_reward", { xp: mission.xpReward })}
                  </span>
                </div>
              );
            })}
          </div>
        </LearnerCard>
      )}
    </div>
  );
}
