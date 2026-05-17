import {
  Sparkles, Star, Trophy, Flame, Coins, Gem, Settings, LogOut,
  Play, Pause, Map, Gift, Backpack, Heart, BookOpen, Beaker,
  Brain, Zap, Target, ChevronRight, Smile, Cloud, Volume2,
} from "lucide-react";
import "./_group.css";

const learner = {
  name: "Maya",
  avatar: "/__mockup/images/nd-visual-avatar.png",
  level: 7,
  xp: 1240,
  xpForNext: 1500,
  coins: 86,
  gems: 12,
  streak: 9,
};

const tutors = [
  { key: "nova",  name: "Nova",  role: "Math Explorer",  icon: Star,     color: "math",    last: "Today" },
  { key: "atlas", name: "Atlas", role: "Reading Guide",  icon: BookOpen, color: "reading", last: "Yesterday" },
  { key: "echo",  name: "Echo",  role: "Science Buddy",  icon: Beaker,   color: "science", last: "2d ago" },
  { key: "spark", name: "Spark", role: "Feelings Friend",icon: Heart,    color: "sel",     last: "Today" },
];

const tabs = [
  { id: "today",      label: "Today",      icon: Backpack },
  { id: "adventures", label: "Adventures", icon: Map },
  { id: "rewards",    label: "Rewards",    icon: Gift },
];

const missions = [
  { id: "m1", title: "Finish 1 session with Nova", tutor: "Nova",  color: "math",    xp: 25, progress: 0, target: 1 },
  { id: "m2", title: "Practice reading with Atlas", tutor: "Atlas", color: "reading", xp: 25, progress: 1, target: 2 },
];

const moods = [
  { e: "😟", label: "Tough" },
  { e: "😕", label: "Meh" },
  { e: "😐", label: "Okay" },
  { e: "🙂", label: "Good" },
  { e: "🌟", label: "Great" },
];

function IconWell({ children, color = "primary" }: { children: React.ReactNode; color?: string }) {
  const map: Record<string, string> = {
    primary: "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]",
    math:    "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]",
    reading: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]",
    science: "bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))]",
    sel:     "bg-[hsl(var(--visual-sel)/0.16)] text-[hsl(var(--visual-sel))]",
  };
  return <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${map[color]}`}>{children}</div>;
}

export function LearnerHome() {
  const xpPct = Math.round((learner.xp / learner.xpForNext) * 100);
  return (
    <div className="nd-visual min-h-screen bg-[hsl(var(--visual-bg))]">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200/60 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[hsl(var(--visual-primary))] to-[hsl(var(--visual-math))] flex items-center justify-center text-white shadow-md">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hi there,</p>
            <h1 className="text-xl font-heading font-extrabold text-slate-900">{learner.name}!</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-amber-50 border-2 border-amber-200 rounded-full px-3 py-1.5">
            <Coins className="w-4 h-4 text-amber-600" />
            <span className="font-heading font-extrabold text-amber-700 text-sm">{learner.coins}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-cyan-50 border-2 border-cyan-200 rounded-full px-3 py-1.5">
            <Gem className="w-4 h-4 text-cyan-600" />
            <span className="font-heading font-extrabold text-cyan-700 text-sm">{learner.gems}</span>
          </div>
          <button className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600">
            <Settings className="w-5 h-5" />
          </button>
          <button className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* Primary slot — Next Action */}
        <div className="nd-visual-card p-6 bg-gradient-to-br from-white to-[hsl(var(--visual-primary)/0.04)] border-2 border-[hsl(var(--visual-primary)/0.15)]">
          <div className="flex items-start gap-4">
            <IconWell color="math"><Star className="w-6 h-6" strokeWidth={2.5} /></IconWell>
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--visual-math))] mb-1">Up Next · Math with Nova</p>
              <h2 className="text-2xl font-heading font-extrabold text-slate-900 mb-2">Counting Adventure 🌟</h2>
              <p className="text-sm text-slate-600 mb-4">Pick up where you left off — just 5 friendly questions.</p>
              <div className="flex items-center gap-3">
                <button className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[hsl(var(--visual-primary))] hover:brightness-110 active:scale-95 transition text-white font-heading font-extrabold shadow-lg shadow-[hsl(var(--visual-primary)/0.25)]">
                  <Play className="w-4 h-4 fill-white" /> Start Now
                </button>
                <button className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-heading font-bold">
                  <Cloud className="w-4 h-4" /> Take a Break
                </button>
              </div>
            </div>
            <div className="hidden md:flex flex-col items-center gap-1 px-4 py-3 rounded-2xl bg-[hsl(var(--visual-sel)/0.14)] border-2 border-[hsl(var(--visual-sel)/0.25)]">
              <Flame className="w-7 h-7 text-[hsl(var(--visual-sel))]" />
              <p className="font-heading font-extrabold text-2xl text-[hsl(var(--visual-sel))] leading-none">{learner.streak}</p>
              <p className="text-[10px] font-bold text-[hsl(var(--visual-sel))] uppercase">streak</p>
            </div>
          </div>
        </div>

        {/* Tabs rail */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-1 p-1.5 rounded-full bg-white border-2 border-slate-200/80 shadow-sm">
            {tabs.map((t, i) => {
              const Icon = t.icon;
              const active = i === 0;
              return (
                <button
                  key={t.id}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-heading font-bold transition ${
                    active
                      ? "bg-[hsl(var(--visual-primary))] text-white shadow-md"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Today: missions + mood check-in */}
        <section className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2 nd-visual-card p-5">
            <div className="flex items-center gap-3 mb-4">
              <IconWell color="primary"><Target className="w-5 h-5" strokeWidth={2.5} /></IconWell>
              <div>
                <h3 className="text-base font-heading font-extrabold text-slate-900">Today's Missions</h3>
                <p className="text-xs text-slate-500 font-semibold">2 small wins waiting</p>
              </div>
            </div>
            <ul className="space-y-3">
              {missions.map(m => {
                const pct = Math.round((m.progress / m.target) * 100);
                return (
                  <li key={m.id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <IconWell color={m.color}><Zap className="w-5 h-5" strokeWidth={2.5} /></IconWell>
                    <div className="flex-1 min-w-0">
                      <p className="font-heading font-bold text-sm text-slate-900 truncate">{m.title}</p>
                      <div className="mt-1.5 h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div className={`h-full rounded-full bg-[hsl(var(--visual-${m.color}))]`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-heading font-extrabold text-xs">
                      +{m.xp} XP
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="nd-visual-card p-5">
            <div className="flex items-center gap-3 mb-4">
              <IconWell color="sel"><Smile className="w-5 h-5" strokeWidth={2.5} /></IconWell>
              <div>
                <h3 className="text-base font-heading font-extrabold text-slate-900">How are you?</h3>
                <p className="text-xs text-slate-500 font-semibold">Tap a feeling</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-1">
              {moods.map(m => (
                <button key={m.label} className="flex flex-col items-center gap-1 p-2 rounded-2xl hover:bg-slate-50 transition active:scale-95">
                  <span className="text-3xl">{m.e}</span>
                  <span className="text-[10px] font-bold text-slate-500">{m.label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Tutor shelf */}
        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-3">
              <IconWell color="primary"><Brain className="w-5 h-5" strokeWidth={2.5} /></IconWell>
              <div>
                <h3 className="text-base font-heading font-extrabold text-slate-900">Your Tutors</h3>
                <p className="text-xs text-slate-500 font-semibold">Pick a friend to learn with</p>
              </div>
            </div>
            <button className="text-xs font-heading font-bold text-[hsl(var(--visual-primary))] inline-flex items-center gap-0.5">
              See all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {tutors.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.key} className="nd-visual-card p-4 text-left group">
                  <div className="flex items-center justify-between mb-3">
                    <IconWell color={t.color}><Icon className="w-6 h-6" strokeWidth={2.5} /></IconWell>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{t.last}</span>
                  </div>
                  <p className="font-heading font-extrabold text-base text-slate-900">{t.name}</p>
                  <p className="text-xs font-semibold text-slate-500 mb-3">{t.role}</p>
                  <div className={`inline-flex items-center gap-1 text-xs font-heading font-bold text-[hsl(var(--visual-${t.color}))]`}>
                    Play <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Quiet progress strip */}
        <section className="nd-visual-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <IconWell color="primary"><Trophy className="w-5 h-5" strokeWidth={2.5} /></IconWell>
              <div>
                <h3 className="text-base font-heading font-extrabold text-slate-900">Level {learner.level}</h3>
                <p className="text-xs text-slate-500 font-semibold">{learner.xp} / {learner.xpForNext} XP</p>
              </div>
            </div>
            <span className="text-xs font-heading font-extrabold text-[hsl(var(--visual-primary))] bg-[hsl(var(--visual-primary)/0.1)] px-2.5 py-1 rounded-full">
              {learner.xpForNext - learner.xp} XP to Level {learner.level + 1}
            </span>
          </div>
          <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--visual-primary))] to-[hsl(var(--visual-math))] transition-all" style={{ width: `${xpPct}%` }} />
          </div>
        </section>
      </main>

      {/* Mobile bottom rail */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-2 flex items-center justify-around">
        {tabs.map((t, i) => {
          const Icon = t.icon;
          const active = i === 0;
          return (
            <button key={t.id} className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-2xl ${active ? "bg-[hsl(var(--visual-primary)/0.1)] text-[hsl(var(--visual-primary))]" : "text-slate-500"}`}>
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-heading font-bold">{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
