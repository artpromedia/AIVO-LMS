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
} from "lucide-react";
import "./_group.css";

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

const scale = [
  { e: "😟", n: 1, label: "Rarely" },
  { e: "😕", n: 2, label: "Sometimes" },
  { e: "😐", n: 3, label: "Often" },
  { e: "🙂", n: 4, label: "Most days" },
  { e: "🌟", n: 5, label: "Always" },
];

const choices = [
  "Reading aloud together",
  "Watching short videos",
  "Hands-on activities",
  "Quiet solo time",
];

const selected = "Hands-on activities";
const selectedScale = 4;

function IconWell({
  children,
  color = "primary",
  size = "md",
}: {
  children: React.ReactNode;
  color?: string;
  size?: "sm" | "md";
}) {
  const map: Record<string, string> = {
    primary: "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]",
    math: "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]",
    reading: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]",
    science: "bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))]",
    sel: "bg-[hsl(var(--visual-sel)/0.16)] text-[hsl(var(--visual-sel))]",
  };
  const sz = size === "sm" ? "w-10 h-10 rounded-xl" : "w-12 h-12 rounded-2xl";
  return <div className={`${sz} flex items-center justify-center ${map[color]}`}>{children}</div>;
}

export function ParentAssessment() {
  const cat = categories.find((c) => c.current)!;
  return (
    <div className="nd-visual min-h-screen bg-[hsl(var(--visual-bg))]">
      {/* Header */}
      <header className="bg-white border-b border-slate-200/60 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-heading font-bold text-slate-500 hover:bg-slate-100 transition">
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
                <p className="text-sm font-heading font-extrabold text-slate-900">
                  Tell us about Maya
                </p>
              </div>
            </div>
          </div>
          <div className="text-xs font-heading font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
            {totalAnswered} / {totalQuestions} answered
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 bg-slate-100">
          <div
            className="h-full bg-gradient-to-r from-[hsl(var(--visual-primary))] to-[hsl(var(--visual-math))] transition-all rounded-r-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-6 space-y-5">
        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {categories.map((c) => {
            const Icon = c.icon;
            const complete = c.answered === c.total && c.total > 0;
            return (
              <button
                key={c.key}
                className={`flex items-center gap-2 flex-shrink-0 px-3 py-2 rounded-full border-2 text-xs font-heading font-bold transition ${
                  c.current
                    ? `bg-[hsl(var(--visual-${c.color})/0.12)] border-[hsl(var(--visual-${c.color}))] text-[hsl(var(--visual-${c.color}))]`
                    : complete
                      ? "bg-[hsl(var(--visual-science)/0.1)] border-[hsl(var(--visual-science)/0.3)] text-[hsl(var(--visual-science))]"
                      : "bg-white border-slate-200 text-slate-500"
                }`}
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

        {/* Question card */}
        <section className="nd-visual-card p-7 space-y-6">
          <div className="flex items-center gap-3">
            <IconWell color={cat.color}>
              <cat.icon className="w-6 h-6" strokeWidth={2.5} />
            </IconWell>
            <div>
              <p
                className="text-[11px] font-bold uppercase tracking-wider"
                style={{ color: `hsl(var(--visual-${cat.color}))` }}
              >
                {cat.label}
              </p>
              <p className="text-xs text-slate-400 font-semibold">Question 3 of {cat.total}</p>
            </div>
          </div>

          <div>
            <h2 className="text-xl md:text-2xl font-heading font-extrabold text-slate-900 leading-snug">
              How does Maya prefer to learn new things?
            </h2>
            <p className="mt-2 text-sm text-slate-500 italic flex items-start gap-1.5">
              <HelpCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-400" />
              Pick what feels most like her. There are no wrong answers.
            </p>
          </div>

          {/* Multiple choice */}
          <div className="space-y-2">
            {choices.map((opt) => {
              const isSel = opt === selected;
              return (
                <button
                  key={opt}
                  className={`w-full flex items-center gap-3 text-left px-4 py-3.5 rounded-2xl border-2 text-sm font-semibold transition ${
                    isSel
                      ? `bg-[hsl(var(--visual-${cat.color})/0.08)] border-[hsl(var(--visual-${cat.color}))] text-[hsl(var(--visual-${cat.color}))]`
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 ${
                      isSel
                        ? `bg-[hsl(var(--visual-${cat.color}))] border-[hsl(var(--visual-${cat.color}))] text-white`
                        : "border-slate-300"
                    }`}
                  >
                    {isSel && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                  </span>
                  <span className="font-heading font-bold">{opt}</span>
                </button>
              );
            })}
          </div>

          {/* Scale (paired example) */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 mb-3">
              <Heart className="w-4 h-4 text-[hsl(var(--visual-sel))]" />
              <p className="text-sm font-heading font-bold text-slate-900">
                How often does this feel true?
              </p>
            </div>
            <div className="flex items-center justify-between gap-1">
              {scale.map((s) => {
                const isSel = s.n === selectedScale;
                return (
                  <button
                    key={s.n}
                    className={`flex flex-col items-center gap-1 p-3 rounded-2xl transition active:scale-95 ${
                      isSel ? `bg-[hsl(var(--visual-${cat.color})/0.1)]` : "hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`text-3xl transition ${isSel ? "scale-110" : "grayscale opacity-50"}`}
                    >
                      {s.e}
                    </span>
                    <span
                      className={`text-[10px] font-heading font-extrabold ${isSel ? `text-[hsl(var(--visual-${cat.color}))]` : "text-slate-400"}`}
                    >
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer nav */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-heading font-bold text-slate-500 hover:bg-slate-100 transition">
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <button
              className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full text-white font-heading font-extrabold text-sm shadow-lg transition active:scale-95"
              style={{ backgroundColor: `hsl(var(--visual-${cat.color}))` }}
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* Reassurance footer */}
        <div className="nd-visual-card p-4 flex items-start gap-3 bg-[hsl(var(--visual-sel)/0.08)] border-2 border-[hsl(var(--visual-sel)/0.2)]">
          <IconWell color="sel" size="sm">
            <Sparkles className="w-5 h-5" strokeWidth={2.5} />
          </IconWell>
          <p className="text-sm text-slate-700">
            Your answers help your tutors meet Maya where she is.{" "}
            <span className="font-heading font-extrabold">You can edit anything later.</span>
          </p>
        </div>
      </main>
    </div>
  );
}
