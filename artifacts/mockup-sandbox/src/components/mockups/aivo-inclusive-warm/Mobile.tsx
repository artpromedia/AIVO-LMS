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
  Map
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import "./_group.css";

export function Mobile() {
  const [mode, setMode] = useState<"standard" | "calm">("standard");

  return (
    <div className={`aivo-inclusive-warm relative w-full h-full max-w-[390px] mx-auto bg-background text-foreground overflow-hidden flex flex-col font-sans transition-colors duration-500 border-x shadow-2xl ${
      mode === "calm" ? "sensory-calm" : ""
    }`}>
      
      {/* Fake iOS Status Bar */}
      <div className="h-12 px-6 flex items-center justify-between text-foreground text-[15px] font-semibold shrink-0 pt-2 z-50 bg-transparent">
        <span>9:41</span>
        <div className="flex items-center gap-2">
          <Signal className="w-4 h-4" />
          <Wifi className="w-4 h-4" />
          <Battery className="w-5 h-5" />
        </div>
      </div>

      {/* App Header */}
      <header className="px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 bg-white/60 backdrop-blur-md px-3 py-2 rounded-full shadow-sm">
          <div className="w-10 h-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-bold text-lg shadow-inner">
            A
          </div>
          <div className="pr-2">
            <h1 className="font-bold text-[15px] leading-tight text-foreground">Alex</h1>
            <p className="text-[11px] font-semibold text-muted-foreground">Level 3 Explorer</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="w-12 h-12 rounded-full bg-white/60 backdrop-blur-md shadow-sm"
            onClick={() => setMode(m => m === "standard" ? "calm" : "standard")}
          >
            <Eye className={`w-5 h-5 ${mode === "calm" ? "text-primary" : "text-muted-foreground"}`} />
          </Button>
        </div>
      </header>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-32 scrollbar-hide">
        
        {/* Companion & Status */}
        <section className="mt-4 mb-8 relative">
          <div className={`rounded-[2.5rem] p-6 flex flex-col items-center text-center transition-all duration-500 relative overflow-hidden ${
            mode === "calm" ? "bg-card border-border/50 border" : "bg-card shadow-lg border border-white/50"
          }`}>
            {mode !== "calm" && (
               <div className="absolute top-0 right-0 w-48 h-48 bg-secondary/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/4"></div>
            )}
            
            <div className="relative w-40 h-40 mb-2">
              <img 
                src="/__mockup/images/aivo-inclusive-warm/companion-3d.png" 
                alt="Digital Companion" 
                className="w-full h-full object-contain relative z-10 drop-shadow-xl"
              />
            </div>
            <h2 className="text-2xl font-extrabold mb-2 text-foreground">Good morning, Alex.</h2>
            <p className="text-muted-foreground text-sm font-medium max-w-[240px]">
              You had great focus yesterday. Ready for today's plan?
            </p>
            
            <div className="w-full mt-8 flex items-center gap-4 bg-white/80 backdrop-blur p-4 rounded-[2rem] border shadow-sm">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 text-amber-700 shrink-0">
                <Star className="w-6 h-6 fill-amber-500" />
              </div>
              <div className="flex-1 text-left">
                <div className="flex justify-between text-xs font-bold mb-2">
                  <span className="text-foreground">Daily Goal</span>
                  <span className="text-amber-600">120 / 200 XP</span>
                </div>
                <Progress value={60} className="h-3 bg-amber-100 rounded-full [&>div]:bg-amber-500" />
              </div>
            </div>
          </div>
        </section>

        {/* Today's Plan */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-xl">Today's Plan</h3>
            <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full">3 Tasks</span>
          </div>
          
          <div className="space-y-4">
            {/* Active Task */}
            <Card className="border-0 shadow-lg rounded-[2rem] overflow-hidden relative bg-white">
              <div className="absolute left-0 top-0 bottom-0 w-2 bg-primary"></div>
              <CardContent className="p-5 pl-7">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-primary text-sm font-bold bg-primary/5 px-3 py-1 rounded-full w-fit">
                    <Calculator className="w-4 h-4" />
                    <span>Math with Nova</span>
                  </div>
                  <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-1 rounded-md">15 mins</span>
                </div>
                <h4 className="font-extrabold text-lg mb-1">Fractions with Trains</h4>
                <p className="text-sm font-medium text-muted-foreground mb-5">
                  Let's sort the freight cars by length.
                </p>
                <Button className="w-full h-14 rounded-full bg-primary hover:bg-primary/90 text-white font-bold text-base shadow-md">
                  Start Lesson <PlayCircle className="w-5 h-5 ml-2" />
                </Button>
              </CardContent>
            </Card>

            {/* Upcoming Task */}
            <Card className="border border-border/50 bg-card rounded-[2rem] shadow-sm opacity-90">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-[1.5rem] bg-indigo-100 flex items-center justify-center shrink-0">
                    <BookOpen className="w-7 h-7 text-indigo-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[15px] mb-0.5">Reading Logic</h4>
                    <p className="text-xs font-semibold text-muted-foreground">Word patterns with Atlas</p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            {/* Break */}
            <Card className="border border-dashed border-border/80 bg-transparent rounded-[2rem] shadow-none">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-[1.5rem] bg-muted/60 flex items-center justify-center shrink-0">
                    <Pause className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[15px] mb-0.5 text-muted-foreground">Brain Break</h4>
                    <p className="text-xs font-semibold text-muted-foreground/60">Scheduled for 10:15</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>

      {/* Dark Capsule Bottom Nav */}
      <div className="absolute bottom-6 left-6 right-6 h-20 bg-[#1a1c23] rounded-full shadow-2xl flex justify-between items-center px-2 z-50">
        <button className="flex-1 flex flex-col items-center justify-center h-full gap-1 rounded-full relative">
          <div className="absolute inset-1 bg-white/10 rounded-full"></div>
          <Map className="w-6 h-6 text-secondary relative z-10" />
          <span className="text-[10px] font-bold text-secondary relative z-10">Map</span>
        </button>
        <button className="flex-1 flex flex-col items-center justify-center h-full gap-1 text-white/50 hover:text-white transition-colors">
          <Brain className="w-6 h-6" />
          <span className="text-[10px] font-bold">Plan</span>
        </button>
        <button className="flex-1 flex flex-col items-center justify-center h-full gap-1 text-white/50 hover:text-white transition-colors">
          <Trophy className="w-6 h-6" />
          <span className="text-[10px] font-bold">Stats</span>
        </button>
        <button className="flex-1 flex flex-col items-center justify-center h-full gap-1 text-white/50 hover:text-white transition-colors">
          <Settings className="w-6 h-6" />
          <span className="text-[10px] font-bold">Settings</span>
        </button>
      </div>
    </div>
  );
}
