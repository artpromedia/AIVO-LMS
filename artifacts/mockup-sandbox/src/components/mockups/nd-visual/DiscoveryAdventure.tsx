import {
  Compass,
  Sparkles,
  Map,
  Star,
  Heart,
  BookOpen,
  Beaker,
  Trophy,
  Play,
  ChevronRight,
  Mountain,
  Zap,
  Shield,
  Brain,
} from "lucide-react";
import "./_group.css";

const chapters = [
  { id: 1, title: "Sunshine Meadow", subject: "SEL", icon: Heart, color: "sel", status: "current" },
  { id: 2, title: "Number Forest", subject: "Math", icon: Star, color: "math", status: "locked" },
  {
    id: 3,
    title: "Story Lake",
    subject: "Reading",
    icon: BookOpen,
    color: "reading",
    status: "locked",
  },
  {
    id: 4,
    title: "Curious Caves",
    subject: "Science",
    icon: Beaker,
    color: "science",
    status: "locked",
  },
  {
    id: 5,
    title: "Treasure Peak",
    subject: "Mixed",
    icon: Trophy,
    color: "primary",
    status: "locked",
  },
];

const promises = [
  {
    icon: Shield,
    title: "Safe & Friendly",
    desc: "Take breaks anytime. There are no wrong answers.",
  },
  { icon: Brain, title: "Just for You", desc: "Your brain helper learns how you like to play." },
  { icon: Zap, title: "Quick & Fun", desc: "About 10 minutes, full of stickers and stars." },
];

function IconWell({
  children,
  color = "primary",
  size = "md",
}: {
  children: React.ReactNode;
  color?: string;
  size?: "sm" | "md" | "lg";
}) {
  const map: Record<string, string> = {
    primary: "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]",
    math: "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]",
    reading: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]",
    science: "bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))]",
    sel: "bg-[hsl(var(--visual-sel)/0.16)] text-[hsl(var(--visual-sel))]",
  };
  const sz =
    size === "lg"
      ? "w-20 h-20 rounded-3xl"
      : size === "sm"
        ? "w-10 h-10 rounded-xl"
        : "w-14 h-14 rounded-2xl";
  return <div className={`${sz} flex items-center justify-center ${map[color]}`}>{children}</div>;
}

export function DiscoveryAdventure() {
  return (
    <div className="nd-visual min-h-screen bg-[hsl(var(--visual-bg))]">
      {/* Adventure map ribbon */}
      <header className="bg-white border-b-2 border-slate-200/60 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <IconWell color="primary" size="sm">
              <Compass className="w-5 h-5" strokeWidth={2.5} />
            </IconWell>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Discovery Adventure
              </p>
              <p className="text-sm font-heading font-extrabold text-slate-900">
                Maya's Baseline · Chapter 0 of 5
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {chapters.map((c) => {
              const Icon = c.icon;
              const isCurrent = c.status === "current";
              return (
                <div
                  key={c.id}
                  className={`flex items-center justify-center rounded-2xl border-2 transition ${
                    isCurrent
                      ? `w-11 h-11 bg-[hsl(var(--visual-${c.color})/0.15)] border-[hsl(var(--visual-${c.color}))] text-[hsl(var(--visual-${c.color}))]`
                      : "w-9 h-9 bg-slate-100 border-slate-200 text-slate-400"
                  }`}
                  title={c.title}
                >
                  <Icon className={isCurrent ? "w-5 h-5" : "w-4 h-4"} strokeWidth={2.5} />
                </div>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {/* Hero */}
        <section className="nd-visual-card p-8 md:p-10 bg-gradient-to-br from-white via-[hsl(var(--visual-primary)/0.04)] to-[hsl(var(--visual-sel)/0.06)] border-2 border-[hsl(var(--visual-primary)/0.15)] text-center relative overflow-hidden">
          {/* Soft decorative dots */}
          <div
            className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-[hsl(var(--visual-sel)/0.18)] blur-2xl"
            aria-hidden
          />
          <div
            className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-[hsl(var(--visual-primary)/0.18)] blur-2xl"
            aria-hidden
          />

          <div className="relative">
            <div className="mx-auto mb-6">
              <IconWell color="primary" size="lg">
                <Compass className="w-10 h-10" strokeWidth={2.5} />
              </IconWell>
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[hsl(var(--visual-primary))] mb-3">
              A Quick Adventure
            </p>
            <h1 className="text-3xl md:text-4xl font-heading font-extrabold text-slate-900 mb-3 leading-tight">
              Hi Maya! Ready to explore?{" "}
              <Sparkles className="inline w-7 h-7 text-[hsl(var(--visual-sel))]" />
            </h1>
            <p className="text-base text-slate-600 max-w-lg mx-auto mb-7 leading-relaxed">
              We'll play 5 short games together so your tutors learn what's just right for you. Take
              your time — every answer helps your brain helper.
            </p>

            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button className="inline-flex items-center gap-2 px-7 py-4 rounded-full bg-[hsl(var(--visual-primary))] hover:brightness-110 active:scale-95 transition text-white font-heading font-extrabold text-lg shadow-xl shadow-[hsl(var(--visual-primary)/0.3)]">
                <Play className="w-5 h-5 fill-white" /> Start the Adventure
              </button>
              <button className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-heading font-bold text-sm">
                Maybe later
              </button>
            </div>
            <p className="mt-5 text-xs text-slate-400 font-semibold">
              About 10 minutes · Pause anytime
            </p>
          </div>
        </section>

        {/* Promises (icon-led) */}
        <section className="grid md:grid-cols-3 gap-3">
          {promises.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.title} className="nd-visual-card p-4 flex items-start gap-3">
                <IconWell color="primary" size="sm">
                  <Icon className="w-5 h-5" strokeWidth={2.5} />
                </IconWell>
                <div>
                  <p className="font-heading font-extrabold text-sm text-slate-900">{p.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-snug">{p.desc}</p>
                </div>
              </div>
            );
          })}
        </section>

        {/* Map preview */}
        <section className="nd-visual-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <IconWell color="primary" size="sm">
                <Map className="w-5 h-5" strokeWidth={2.5} />
              </IconWell>
              <div>
                <h2 className="text-lg font-heading font-extrabold text-slate-900">
                  Your Adventure Map
                </h2>
                <p className="text-xs text-slate-500 font-semibold">
                  5 friendly chapters · earn a sticker for each
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-heading font-extrabold text-[hsl(var(--visual-primary))] bg-[hsl(var(--visual-primary)/0.1)] px-2.5 py-1 rounded-full">
              <Mountain className="w-3.5 h-3.5" /> 5 stops
            </span>
          </div>

          <ol className="relative space-y-3">
            <div
              className="absolute left-7 top-3 bottom-3 w-0.5 bg-gradient-to-b from-[hsl(var(--visual-primary)/0.3)] via-slate-200 to-slate-200"
              aria-hidden
            />
            {chapters.map((c, i) => {
              const Icon = c.icon;
              const isCurrent = c.status === "current";
              return (
                <li
                  key={c.id}
                  className={`relative flex items-center gap-4 p-3 rounded-2xl border-2 transition ${
                    isCurrent
                      ? `bg-[hsl(var(--visual-${c.color})/0.06)] border-[hsl(var(--visual-${c.color})/0.3)]`
                      : "bg-slate-50 border-transparent"
                  }`}
                >
                  <IconWell color={c.color}>
                    <Icon className="w-6 h-6" strokeWidth={2.5} />
                  </IconWell>
                  <div className="flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Chapter {i + 1} · {c.subject}
                    </p>
                    <p className="font-heading font-extrabold text-base text-slate-900">
                      {c.title}
                    </p>
                  </div>
                  {isCurrent ? (
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[hsl(var(--visual-${c.color}))] text-white font-heading font-extrabold text-xs shadow-md`}
                    >
                      Start <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  ) : (
                    <span className="text-xs font-heading font-bold text-slate-400">Locked</span>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      </main>
    </div>
  );
}
