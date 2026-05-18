import React from 'react';
import { Compass, Star, Map as MapIcon, ChevronRight, Play, Pause, Activity, BrainCircuit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import './_group.css';

export function Mobile() {
  return (
    <div className="aivo-qa-theme min-h-[100dvh] w-full bg-background flex flex-col font-sans relative overflow-hidden">
      {/* Background soft gradients */}
      <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
      
      {/* Status Bar Header Area */}
      <header className="px-6 pt-12 pb-6 relative z-10 flex justify-between items-end">
        <div>
          <p className="text-sm text-muted-foreground font-inter mb-1">Good morning,</p>
          <h1 className="text-2xl font-bold tracking-tight">Leo</h1>
        </div>
        <div className="flex items-center gap-2 bg-secondary px-3 py-1.5 rounded-full border border-border/50">
          <Star className="size-4 text-primary fill-primary" />
          <span className="font-inter font-medium text-sm">450</span>
        </div>
      </header>

      <main className="flex-1 px-6 pb-24 overflow-y-auto z-10 space-y-8">
        
        {/* Current Path */}
        <section>
          <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground mb-4">Today's Focus</h2>
          <Card className="border-border/60 shadow-sm bg-card rounded-2xl overflow-hidden p-1">
            <div className="bg-secondary/30 rounded-xl p-5 border border-border/40">
              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                  <Compass className="size-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Fraction Fundamentals</h3>
                  <p className="text-sm text-muted-foreground font-inter">Math • Level 3</p>
                </div>
              </div>
              
              <div className="mb-6">
                <div className="flex justify-between text-xs font-inter mb-2">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">60%</span>
                </div>
                <div className="h-2 w-full bg-border rounded-full overflow-hidden">
                  <div className="h-full bg-primary w-[60%] rounded-full" />
                </div>
              </div>

              <Button className="w-full rounded-xl py-6 text-base font-medium group">
                <Play className="size-5 mr-2" />
                Resume Session
              </Button>
            </div>
          </Card>
        </section>

        {/* AI Tutors */}
        <section>
          <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground mb-4">Your Team</h2>
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 snap-x hide-scrollbar">
            
            {/* Tutor 1 */}
            <Card className="min-w-[140px] border-border/60 shadow-sm bg-card rounded-2xl p-4 snap-start shrink-0 cursor-pointer hover:border-primary/30 transition-colors">
              <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
                <BrainCircuit className="size-6" />
              </div>
              <h4 className="font-semibold">Nova</h4>
              <p className="text-xs text-muted-foreground font-inter mt-1">Science Guide</p>
            </Card>

            {/* Tutor 2 */}
            <Card className="min-w-[140px] border-border/60 shadow-sm bg-card rounded-2xl p-4 snap-start shrink-0 cursor-pointer hover:border-primary/30 transition-colors">
              <div className="size-12 rounded-full bg-accent/10 text-accent flex items-center justify-center mb-3">
                <MapIcon className="size-6" />
              </div>
              <h4 className="font-semibold">Atlas</h4>
              <p className="text-xs text-muted-foreground font-inter mt-1">History Guide</p>
            </Card>

            {/* Tutor 3 */}
            <Card className="min-w-[140px] border-border/60 shadow-sm bg-card rounded-2xl p-4 snap-start shrink-0 cursor-pointer hover:border-primary/30 transition-colors">
              <div className="size-12 rounded-full bg-muted border border-border flex items-center justify-center mb-3">
                <Activity className="size-6 text-muted-foreground" />
              </div>
              <h4 className="font-semibold text-muted-foreground">Locked</h4>
              <p className="text-xs text-muted-foreground font-inter mt-1">Level 5 req.</p>
            </Card>

          </div>
        </section>

      </main>

      {/* Bottom Nav */}
      <nav className="absolute bottom-0 left-0 right-0 bg-background/80 backdrop-blur-lg border-t border-border/50 pb-safe z-20">
        <div className="flex items-center justify-around px-6 py-4">
          <button className="flex flex-col items-center gap-1 text-primary">
            <Compass className="size-6" />
            <span className="text-[10px] font-medium font-inter">Path</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
            <Star className="size-6" />
            <span className="text-[10px] font-medium font-inter">Quests</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
            <BrainCircuit className="size-6" />
            <span className="text-[10px] font-medium font-inter">Tutors</span>
          </button>
        </div>
      </nav>

    </div>
  );
}
