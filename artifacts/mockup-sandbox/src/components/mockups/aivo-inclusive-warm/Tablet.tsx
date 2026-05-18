import React, { useState } from "react";
import {
  Settings,
  Eye,
  Battery,
  Wifi,
  Signal,
  ChevronRight,
  BookOpen,
  Calculator,
  PlayCircle,
  Star,
  Trophy,
  Brain,
  Pause,
  Map,
  Camera,
  Compass,
  Ribbon,
  BarChart3,
  Flame,
  Coins,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import "./_group.css";

/**
 * Tablet-format mockup for the inclusive-warm learner home.
 *
 * Mirrors the production tablet layout used by `apps/mobile`:
 *  - Persistent left navigation rail (replaces the floating dark capsule
 *    used on phones — DarkCapsuleNav now auto-hides on tablets via
 *    `hideOnTablet`, default true).
 *  - 1080dp centered content column (CONTENT_MAX_WIDTH.dashboard) so
 *    cards don't stretch edge-to-edge on landscape iPad / Pixel Tablet.
 *  - Wider tutor grid (4 columns instead of phone's 2).
 *  - Amplified display headline matching `useResponsiveType` on the
 *    `expanded` size class (≈+50%).
 */
export function Tablet() {
  const [mode, setMode] = useState<"standard" | "calm">("standard");

  const railItems = [
    { icon: Map, label: "World Map", active: true },
    { icon: Brain, label: "Brain" },
    { icon: Camera, label: "Homework" },
    { icon: Compass, label: "Quests" },
    { icon: BarChart3, label: "Grades" },
    { icon: Trophy, label: "Profile" },
    { icon: Settings, label: "Settings" },
  ];

  const tutors = [
    { icon: "🚂", name: "Nova", domain: "Math" },
    { icon: "📚", name: "Atlas", domain: "Reading" },
    { icon: "🔬", name: "Sage", domain: "Science" },
    { icon: "🎨", name: "Echo", domain: "Art" },
    { icon: "🌍", name: "Terra", domain: "World" },
    { icon: "🎵", name: "Lyric", domain: "Music" },
  ];

  return (
    <div
      className={`aivo-inclusive-warm relative w-full h-full bg-background text-foreground overflow-hidden flex font-sans transition-colors duration-500 border shadow-2xl ${
        mode === "calm" ? "sensory-calm" : ""
      }`}
    >
      {/* Fake iPad status bar — fixed top, full width */}
      <div className="absolute top-0 left-0 right-0 h-8 px-6 flex items-center justify-between text-foreground text-[13px] font-semibold z-50 bg-transparent">
        <span>9:41</span>
        <div className="flex items-center gap-2">
          <Signal className="w-4 h-4" />
          <Wifi className="w-4 h-4" />
          <Battery className="w-5 h-5" />
        </div>
      </div>

      {/* Persistent left navigation rail (drawer variant — 240dp) */}
      <aside className="w-60 shrink-0 bg-card border-r flex flex-col pt-12 pb-4 px-3 gap-1">
        <div className="px-3 mb-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-bold text-lg shadow-inner">
            A
          </div>
          <div>
            <p className="font-bold text-sm leading-tight">Alex</p>
            <p className="text-[11px] font-semibold text-muted-foreground">Level 3 Explorer</p>
          </div>
        </div>
        {railItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                item.active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          );
        })}
        <div className="mt-auto pt-4 border-t">
          <button
            onClick={() => setMode((m) => (m === "standard" ? "calm" : "standard"))}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted"
          >
            <Eye className={`w-5 h-5 ${mode === "calm" ? "text-primary" : ""}`} />
            <span>{mode === "calm" ? "Calm mode" : "Standard mode"}</span>
          </button>
        </div>
      </aside>

      {/* Main scrollable area — centered 1080dp content column */}
      <main className="flex-1 overflow-y-auto pt-12">
        <div className="max-w-[1080px] mx-auto px-8 pb-12">
          {/* Hero — amplified display ramp */}
          <section className="mb-8">
            <div
              className={`rounded-[2.5rem] p-8 flex items-center gap-8 transition-all duration-500 relative overflow-hidden ${
                mode === "calm"
                  ? "bg-card border-border/50 border"
                  : "bg-card shadow-lg border border-white/50"
              }`}
            >
              {mode !== "calm" && (
                <div className="absolute top-0 right-0 w-72 h-72 bg-secondary/10 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4"></div>
              )}
              <div className="relative w-44 h-44 shrink-0">
                <img
                  src="/__mockup/images/aivo-inclusive-warm/companion-3d.png"
                  alt="Digital Companion"
                  className="w-full h-full object-contain relative z-10 drop-shadow-xl"
                />
              </div>
              <div className="flex-1 relative z-10">
                <h2 className="text-[44px] leading-[1.1] font-extrabold mb-2 text-foreground tracking-tight">
                  Good morning, Alex.
                </h2>
                <p className="text-muted-foreground text-base font-medium max-w-[420px] mb-5">
                  You had great focus yesterday. Ready for today's plan?
                </p>
                <div className="flex items-center gap-4 bg-white/80 backdrop-blur p-4 rounded-[1.5rem] border shadow-sm max-w-md">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 text-amber-700 shrink-0">
                    <Star className="w-6 h-6 fill-amber-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs font-bold mb-2">
                      <span className="text-foreground">Daily Goal</span>
                      <span className="text-amber-600">120 / 200 XP</span>
                    </div>
                    <Progress
                      value={60}
                      className="h-3 bg-amber-100 rounded-full [&>div]:bg-amber-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Stats strip — 3 columns */}
          <section className="grid grid-cols-3 gap-4 mb-8">
            {[
              { icon: Coins, label: "Coins", value: 240, tint: "amber" },
              { icon: Ribbon, label: "Badges", value: 12, tint: "violet" },
              { icon: Flame, label: "Streak", value: 7, tint: "primary" },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.label}
                  className="flex items-center gap-3 p-4 rounded-2xl border bg-card"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-extrabold text-lg leading-none">{s.value}</p>
                    <p className="text-xs font-semibold text-muted-foreground mt-1">
                      {s.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </section>

          {/* Today's Plan + tutor grid in two columns */}
          <div className="grid grid-cols-[1.2fr_1fr] gap-8 items-start">
            <section>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-2xl">Today's Plan</h3>
                <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full">
                  3 Tasks
                </span>
              </div>
              <div className="space-y-4">
                <Card className="border-0 shadow-lg rounded-[2rem] overflow-hidden relative bg-white">
                  <div className="absolute left-0 top-0 bottom-0 w-2 bg-primary"></div>
                  <CardContent className="p-6 pl-8">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-primary text-sm font-bold bg-primary/5 px-3 py-1 rounded-full w-fit">
                        <Calculator className="w-4 h-4" />
                        <span>Math with Nova</span>
                      </div>
                      <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-1 rounded-md">
                        15 mins
                      </span>
                    </div>
                    <h4 className="font-extrabold text-xl mb-1">Fractions with Trains</h4>
                    <p className="text-sm font-medium text-muted-foreground mb-5">
                      Let's sort the freight cars by length.
                    </p>
                    <Button className="h-12 px-6 rounded-full bg-primary hover:bg-primary/90 text-white font-bold text-base shadow-md">
                      Start Lesson <PlayCircle className="w-5 h-5 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
                <Card className="border border-border/50 bg-card rounded-[2rem] shadow-sm">
                  <CardContent className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-[1.5rem] bg-[#ede9fe] flex items-center justify-center shrink-0">
                        <BookOpen className="w-7 h-7 text-[#7c3aed]" />
                      </div>
                      <div>
                        <h4 className="font-bold text-base mb-0.5">Reading Logic</h4>
                        <p className="text-xs font-semibold text-muted-foreground">
                          Word patterns with Atlas
                        </p>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="border border-dashed border-border/80 bg-transparent rounded-[2rem] shadow-none">
                  <CardContent className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-[1.5rem] bg-muted/60 flex items-center justify-center shrink-0">
                        <Pause className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <div>
                        <h4 className="font-bold text-base mb-0.5 text-muted-foreground">
                          Brain Break
                        </h4>
                        <p className="text-xs font-semibold text-muted-foreground/60">
                          Scheduled for 10:15
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* Tutor world grid — 2 columns on the side */}
            <section>
              <h3 className="font-bold text-2xl mb-5">Quest Worlds</h3>
              <div className="grid grid-cols-2 gap-3">
                {tutors.map((t) => (
                  <button
                    key={t.name}
                    className="p-4 rounded-2xl border bg-card hover:shadow-md transition-shadow flex flex-col items-center text-center"
                  >
                    <span className="text-4xl mb-2">{t.icon}</span>
                    <p className="font-bold text-sm">{t.name}</p>
                    <p className="text-xs font-medium text-muted-foreground">{t.domain}</p>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
