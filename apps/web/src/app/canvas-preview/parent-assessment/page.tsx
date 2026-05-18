import {
  ArrowLeft,
  MessageCircle,
  Hand,
  GraduationCap,
  ListChecks,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Check,
  HelpCircle,
  Heart,
  Frown,
  Annoyed,
  Meh,
  Smile,
  Star,
  type LucideIcon,
} from "lucide-react";
import { ViTokens } from "../_tokens";

const categories = [
  {
    key: "communication",
    label: "Communication",
    icon: MessageCircle,
    color: "reading",
    answered: 4,
    total: 4,
    current: false,
  },
  {
    key: "interaction",
    label: "Interaction",
    icon: Hand,
    color: "sel",
    answered: 3,
    total: 3,
    current: false,
  },
  {
    key: "learning",
    label: "Learning Style",
    icon: GraduationCap,
    color: "math",
    answered: 2,
    total: 5,
    current: true,
  },
  {
    key: "checklist",
    label: "Wellbeing",
    icon: ListChecks,
    color: "science",
    answered: 0,
    total: 4,
    current: false,
  },
  {
    key: "sensory",
    label: "Sensory",
    icon: Sparkles,
    color: "primary",
    answered: 0,
    total: 3,
    current: false,
  },
];
const totalAnswered = categories.reduce((s, c) => s + c.answered, 0);
const totalQuestions = categories.reduce((s, c) => s + c.total, 0);
const progress = Math.round((totalAnswered / totalQuestions) * 100);

const scale: { Icon: LucideIcon; n: number; label: string }[] = [
  { Icon: Frown, n: 1, label: "Rarely" },
  { Icon: Annoyed, n: 2, label: "Sometimes" },
  { Icon: Meh, n: 3, label: "Often" },
  { Icon: Smile, n: 4, label: "Most days" },
  { Icon: Star, n: 5, label: "Always" },
];
const choices = [
  "Reading aloud together",
  "Watching short videos",
  "Hands-on activities",
  "Quiet solo time",
];
const selected = "Hands-on activities";
const selectedScale = 4;

const wellMap: Record<string, string> = {
  primary: "bg-[hsl(262_83%_58%/0.12)] text-[hsl(262_83%_58%)]",
  math: "bg-[hsl(340_82%_52%/0.12)] text-[hsl(340_82%_52%)]",
  reading: "bg-[hsl(199_89%_48%/0.12)] text-[hsl(199_89%_48%)]",
  science: "bg-[hsl(142_71%_45%/0.12)] text-[hsl(142_71%_45%)]",
  sel: "bg-[hsl(43_100%_50%/0.16)] text-[hsl(43_100%_50%)]",
};
const colorMap: Record<string, string> = {
  primary: "hsl(262 83% 58%)",
  math: "hsl(340 82% 52%)",
  reading: "hsl(199 89% 48%)",
  science: "hsl(142 71% 45%)",
  sel: "hsl(43 100% 50%)",
};
const tintMap: Record<string, string> = {
  primary: "hsl(262 83% 58% / 0.08)",
  math: "hsl(340 82% 52% / 0.08)",
  reading: "hsl(199 89% 48% / 0.08)",
  science: "hsl(142 71% 45% / 0.08)",
  sel: "hsl(43 100% 50% / 0.10)",
};

function IconWell({
  children,
  color = "primary",
  size = "md",
}: {
  children: React.ReactNode;
  color?: string;
  size?: "sm" | "md";
}) {
  const sz = size === "sm" ? "w-10 h-10 rounded-xl" : "w-12 h-12 rounded-2xl";
  return (
    <div className={`${sz} flex items-center justify-center ${wellMap[color]}`}>{children}</div>
  );
}

export default function ParentAssessmentPreview() {
  const cat = categories.find((c) => c.current)!;
  const Cat = cat.icon;
  return (
    <>
      <ViTokens />
      <div className="vi-root min-h-screen">
        <header className="bg-white border-b border-slate-200/60 sticky top-0 z-20">
          <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-bold text-slate-500">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <div className="hidden sm:flex items-center gap-2">
                <IconWell color="primary" size="sm">
                  <Sparkles className="w-5 h-5" strokeWidth={2.5} />
                </IconWell>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Parent Assessment
                  </p>
                  <p className="text-sm font-extrabold text-slate-900">Tell us about Maya</p>
                </div>
              </div>
            </div>
            <div className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
              {totalAnswered} / {totalQuestions} answered
            </div>
          </div>
          <div className="h-1.5 bg-slate-100">
            <div
              className="h-full bg-gradient-to-r from-[hsl(262_83%_58%)] to-[hsl(340_82%_52%)] rounded-r-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-6 py-6 space-y-5">
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {categories.map((c) => {
              const Icon = c.icon;
              const complete = c.answered === c.total && c.total > 0;
              return (
                <button
                  key={c.key}
                  aria-pressed={c.current}
                  aria-label={`${c.label}: ${c.answered} of ${c.total} answered${complete ? ", complete" : ""}`}
                  className="flex items-center gap-2 flex-shrink-0 px-3 py-2 rounded-full border-2 text-xs font-bold"
                  style={
                    c.current
                      ? {
                          backgroundColor: tintMap[c.color],
                          borderColor: colorMap[c.color],
                          color: colorMap[c.color],
                        }
                      : complete
                        ? {
                            backgroundColor: "hsl(142 71% 45% / 0.1)",
                            borderColor: "hsl(142 71% 45% / 0.3)",
                            color: "hsl(142 71% 45%)",
                          }
                        : {
                            backgroundColor: "white",
                            borderColor: "rgb(226 232 240)",
                            color: "rgb(100 116 139)",
                          }
                  }
                >
                  <Icon className="w-4 h-4" strokeWidth={2.5} />
                  <span>{c.label}</span>
                  {complete ? (
                    <Check className="w-3.5 h-3.5" strokeWidth={3} />
                  ) : (
                    <span
                      className={`text-[10px] font-extrabold tabular-nums ${c.current ? "" : "text-slate-400"}`}
                    >
                      {c.answered}/{c.total}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <section className="vi-card p-7 space-y-6">
            <div className="flex items-center gap-3">
              <IconWell color={cat.color}>
                <Cat className="w-6 h-6" strokeWidth={2.5} />
              </IconWell>
              <div>
                <p
                  className="text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: colorMap[cat.color] }}
                >
                  {cat.label}
                </p>
                <p className="text-xs text-slate-400 font-semibold">Question 3 of {cat.total}</p>
              </div>
            </div>

            <div>
              <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 leading-snug">
                How does Maya prefer to learn new things?
              </h2>
              <p className="mt-2 text-sm text-slate-500 italic flex items-start gap-1.5">
                <HelpCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-400" />
                Pick what feels most like her. There are no wrong answers.
              </p>
            </div>

            <div className="space-y-2">
              {choices.map((opt) => {
                const isSel = opt === selected;
                return (
                  <button
                    key={opt}
                    role="radio"
                    aria-checked={isSel}
                    className="w-full flex items-center gap-3 text-left px-4 py-3.5 rounded-2xl border-2 text-sm font-semibold"
                    style={
                      isSel
                        ? {
                            backgroundColor: tintMap[cat.color],
                            borderColor: colorMap[cat.color],
                            color: colorMap[cat.color],
                          }
                        : {
                            backgroundColor: "white",
                            borderColor: "rgb(226 232 240)",
                            color: "rgb(71 85 105)",
                          }
                    }
                  >
                    <span
                      className="w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0"
                      style={
                        isSel
                          ? {
                              backgroundColor: colorMap[cat.color],
                              borderColor: colorMap[cat.color],
                              color: "white",
                            }
                          : { borderColor: "rgb(203 213 225)" }
                      }
                    >
                      {isSel && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                    </span>
                    <span className="font-bold">{opt}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 mb-3">
                <Heart className="w-4 h-4 text-[hsl(43_100%_50%)]" />
                <p className="text-sm font-bold text-slate-900">How often does this feel true?</p>
              </div>
              <div className="flex items-center justify-between gap-1">
                {scale.map((s) => {
                  const isSel = s.n === selectedScale;
                  return (
                    <button
                      key={s.n}
                      role="radio"
                      aria-checked={isSel}
                      aria-label={`${s.label} (${s.n} of 5)`}
                      className="flex flex-col items-center gap-1 p-3 rounded-2xl"
                      style={isSel ? { backgroundColor: tintMap[cat.color] } : undefined}
                    >
                      <span
                        className={`flex items-center justify-center ${isSel ? "scale-110" : "opacity-40"}`}
                        aria-hidden
                        style={{ color: isSel ? colorMap[cat.color] : "rgb(148 163 184)" }}
                      >
                        <s.Icon className="w-7 h-7" strokeWidth={2} />
                      </span>
                      <span
                        className="text-[10px] font-extrabold"
                        style={{ color: isSel ? colorMap[cat.color] : "rgb(148 163 184)" }}
                      >
                        {s.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-bold text-slate-500">
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              <button
                className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full text-white font-extrabold text-sm shadow-lg"
                style={{ backgroundColor: colorMap[cat.color] }}
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </section>

          <div className="vi-card p-4 flex items-start gap-3 bg-[hsl(43_100%_50%/0.08)] border-2 border-[hsl(43_100%_50%/0.2)]">
            <IconWell color="sel" size="sm">
              <Sparkles className="w-5 h-5" strokeWidth={2.5} />
            </IconWell>
            <p className="text-sm text-slate-700">
              Your answers help your tutors meet Maya where she is.{" "}
              <span className="font-extrabold">You can edit anything later.</span>
            </p>
          </div>
        </main>
      </div>
    </>
  );
}
