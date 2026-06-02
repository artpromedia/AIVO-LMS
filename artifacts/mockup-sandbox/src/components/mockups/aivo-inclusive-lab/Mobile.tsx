import React, { useState } from "react";
import {
  Menu,
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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import "./_group.css";

export function Mobile() {
  const [mode, setMode] = useState<"standard" | "calm">("standard");

  return (
    <div
      className={`aivo-inclusive-lab relative w-full h-full max-w-[390px] mx-auto bg-background text-foreground overflow-hidden flex flex-col font-sans transition-colors duration-500 border-x ${
        mode === "calm" ? "sensory-calm" : ""
      }`}
    >
      {/* Fake iOS Status Bar */}
      <div className="h-12 px-5 flex items-center justify-between text-foreground text-[15px] font-medium shrink-0 pt-2 z-50 bg-background">
        <span>9:41</span>
        <div className="flex items-center gap-1.5">
          <Signal className="w-4 h-4" />
          <Wifi className="w-4 h-4" />
          <Battery className="w-5 h-5" />
        </div>
      </div>

      {/* App Header */}
      <header className="px-6 py-4 flex items-center justify-between bg-background shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold border border-primary/20">
            A
          </div>
          <div>
            <h1 className="font-semibold text-lg leading-tight">Alex</h1>
            <p className="text-xs text-muted-foreground">Level 3 Scholar</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="w-9 h-9 rounded-full bg-muted/50"
            onClick={() => setMode((m) => (m === "standard" ? "calm" : "standard"))}
          >
            <Eye className={`w-4 h-4 ${mode === "calm" ? "text-primary" : ""}`} />
          </Button>
        </div>
      </header>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-24 scrollbar-hide">
        {/* Companion & Status */}
        <section className="mt-2 mb-8 relative">
          <div
            className={`rounded-3xl p-6 flex flex-col items-center text-center transition-all duration-500 ${
              mode === "calm" ? "bg-muted/30" : "bg-gradient-to-b from-primary/10 to-transparent"
            }`}
          >
            <div className="relative w-32 h-32 mb-4">
              <div className="absolute inset-0 bg-secondary/20 rounded-full blur-2xl animate-pulse"></div>
              <img
                src="/__mockup/images/aivo-inclusive-lab/companion.png"
                alt="Digital Companion"
                className="w-full h-full object-contain relative z-10"
              />
            </div>
            <h2 className="text-2xl font-bold mb-2">Good morning, Alex.</h2>
            <p className="text-muted-foreground text-sm max-w-[240px]">
              You had great focus yesterday. Ready for today's plan?
            </p>

            <div className="w-full mt-6 flex items-center gap-4 bg-background p-3 rounded-2xl border shadow-sm">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 text-amber-700">
                <Star className="w-5 h-5 fill-amber-500" />
              </div>
              <div className="flex-1 text-left">
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>Daily Goal</span>
                  <span>120 / 200 XP</span>
                </div>
                <Progress value={60} className="h-2" />
              </div>
            </div>
          </div>
        </section>

        {/* Today's Plan */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">Today's Plan</h3>
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full">
              3 Tasks
            </span>
          </div>

          <div className="space-y-3">
            {/* Active Task */}
            <Card className="border-primary shadow-sm overflow-hidden relative">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary"></div>
              <CardContent className="p-4 pl-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-primary text-sm font-semibold">
                    <Calculator className="w-4 h-4" />
                    <span>Math Explorer</span>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">15 mins</span>
                </div>
                <h4 className="font-bold mb-1">Fractions with Trains</h4>
                <p className="text-xs text-muted-foreground mb-4">
                  Let's sort the freight cars by length.
                </p>
                <Button className="w-full h-10 shadow-none">
                  Start Lesson <PlayCircle className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>

            {/* Upcoming Task */}
            <Card className="border-border/50 bg-muted/20 shadow-none opacity-80">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">Reading Logic</h4>
                    <p className="text-xs text-muted-foreground">Word patterns</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </CardContent>
            </Card>

            {/* Break */}
            <Card className="border-border/50 bg-background shadow-none border-dashed">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                    <Pause className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">Brain Break</h4>
                    <p className="text-xs text-muted-foreground">Scheduled for 10:15</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>

      {/* Bottom Nav */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-background border-t flex justify-around items-center px-6 pb-6 pt-2 z-50">
        <button className="flex flex-col items-center gap-1 text-primary">
          <Brain className="w-6 h-6" />
          <span className="text-[10px] font-semibold">Plan</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
          <Trophy className="w-6 h-6" />
          <span className="text-[10px] font-medium">Stats</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
          <Settings className="w-6 h-6" />
          <span className="text-[10px] font-medium">Settings</span>
        </button>
      </div>
    </div>
  );
}
