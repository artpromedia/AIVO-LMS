import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Activity, BrainCircuit, ShieldCheck, Settings, ArrowRight, Play, CheckCircle2, ChevronRight, Moon, Sun, Ear } from 'lucide-react';
import './_group.css';

export function Web() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSensoryMode, setIsSensoryMode] = useState(false);

  return (
    <div className={`aivo-qa-theme min-h-screen flex flex-col transition-colors duration-500 ${isDarkMode ? 'dark' : ''} ${isSensoryMode ? 'opacity-90 contrast-75' : ''}`}>
      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-6 bg-primary rounded-sm flex items-center justify-center">
              <div className="size-2 bg-primary-foreground rounded-full" />
            </div>
            <span className="font-bold text-lg tracking-tight">AIVO</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground font-inter">
            <a href="#" className="hover:text-foreground transition-colors">Platform</a>
            <a href="#" className="hover:text-foreground transition-colors">Research</a>
            <a href="#" className="hover:text-foreground transition-colors">For Districts</a>
            <a href="#" className="hover:text-foreground transition-colors">For Families</a>
          </nav>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 mr-4 border-r pr-4 border-border">
              <button 
                onClick={() => setIsSensoryMode(!isSensoryMode)}
                className="text-xs font-inter flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                title="Toggle Low Contrast Mode"
              >
                <Ear className="size-4" />
                <span className="hidden sm:inline">Sensory Profile</span>
              </button>
              <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {isDarkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </button>
            </div>
            <a href="#" className="text-sm font-medium hover:text-foreground transition-colors hidden sm:block font-inter">Log in</a>
            <Button size="sm" className="rounded-full px-5 font-inter">Start Free Trial</Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative pt-24 pb-32 overflow-hidden bg-noise">
          <div className="container mx-auto px-6 max-w-5xl text-center">
            <Badge variant="secondary" className="mb-6 py-1.5 px-3 rounded-full font-inter border-border/50 text-muted-foreground font-normal">
              FERPA & COPPA Compliant • Built on MIT Research
            </Badge>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-[1.1] text-foreground">
              Education designed for <br className="hidden md:block"/> the way their brain works.
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 font-inter leading-relaxed">
              AIVO is an adaptive learning environment that dynamically adjusts to neurodiverse learning profiles. 14 specialized AI tutors, 5 cognitive functioning levels, zero friction.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="rounded-full px-8 w-full sm:w-auto text-base">
                Get Started for Families
              </Button>
              <Button size="lg" variant="outline" className="rounded-full px-8 w-full sm:w-auto text-base">
                Request District Demo
              </Button>
            </div>
          </div>
        </section>

        {/* Product UI Mockup */}
        <section className="pb-24 pt-4">
          <div className="container mx-auto px-6">
            <div className="relative mx-auto max-w-4xl rounded-2xl border border-border/50 bg-background shadow-2xl overflow-hidden aspect-[16/10] flex flex-col">
              <div className="h-12 border-b border-border/50 flex items-center px-4 gap-2 bg-secondary/50">
                <div className="flex gap-1.5">
                  <div className="size-3 rounded-full bg-border" />
                  <div className="size-3 rounded-full bg-border" />
                  <div className="size-3 rounded-full bg-border" />
                </div>
                <div className="mx-auto bg-background border border-border/50 rounded-md px-32 py-1 text-xs text-muted-foreground font-inter">
                  aivo.app/learner/home
                </div>
              </div>
              <div className="flex-1 bg-secondary/20 p-8 flex gap-8">
                {/* Sidebar */}
                <div className="w-48 flex flex-col gap-4">
                  <div className="h-8 w-24 bg-border/50 rounded-md mb-4" />
                  <div className="h-6 w-full bg-primary/10 rounded-md" />
                  <div className="h-6 w-3/4 bg-border/50 rounded-md" />
                  <div className="h-6 w-5/6 bg-border/50 rounded-md" />
                </div>
                {/* Main Content */}
                <div className="flex-1 flex flex-col gap-6">
                  <div className="h-32 w-full bg-background border border-border/50 rounded-xl p-6 flex flex-col justify-between">
                    <div className="h-6 w-1/3 bg-foreground/10 rounded-md" />
                    <div className="h-4 w-2/3 bg-muted rounded-md" />
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="h-48 bg-background border border-border/50 rounded-xl p-6">
                       <div className="size-10 rounded-full bg-primary/20 mb-4" />
                       <div className="h-4 w-1/2 bg-foreground/10 rounded-md mb-2" />
                       <div className="h-3 w-3/4 bg-muted rounded-md" />
                    </div>
                    <div className="h-48 bg-background border border-border/50 rounded-xl p-6">
                       <div className="size-10 rounded-full bg-primary/20 mb-4" />
                       <div className="h-4 w-1/2 bg-foreground/10 rounded-md mb-2" />
                       <div className="h-3 w-3/4 bg-muted rounded-md" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="py-24 bg-secondary/30 border-y border-border/50">
          <div className="container mx-auto px-6 max-w-5xl">
            <div className="mb-16">
              <h2 className="text-3xl font-bold tracking-tight mb-4">Intentional architecture.</h2>
              <p className="text-muted-foreground font-inter max-w-2xl text-lg">We removed the visual noise, gamification friction, and punitive grading that alienates neurodivergent learners.</p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12">
              <div className="flex flex-col gap-4">
                <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <BrainCircuit className="size-5" />
                </div>
                <h3 className="font-semibold text-xl">Cognitive Pacing</h3>
                <p className="text-muted-foreground font-inter text-sm leading-relaxed">
                  Lessons dynamically adapt their delivery speed and complexity based on real-time frustration signals and focus metrics.
                </p>
              </div>
              <div className="flex flex-col gap-4">
                <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Settings className="size-5" />
                </div>
                <h3 className="font-semibold text-xl">Sensory Profiles</h3>
                <p className="text-muted-foreground font-inter text-sm leading-relaxed">
                  Parents control visual contrast, audio stimulation, and interface density. The UI morphs to meet the child's sensory needs that day.
                </p>
              </div>
              <div className="flex flex-col gap-4">
                <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <ShieldCheck className="size-5" />
                </div>
                <h3 className="font-semibold text-xl">Enterprise Security</h3>
                <p className="text-muted-foreground font-inter text-sm leading-relaxed">
                  SOC2 Type II, FERPA, and COPPA certified out of the box. District-level data governance and granular access controls.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonial / Social Proof */}
        <section className="py-32">
          <div className="container mx-auto px-6 max-w-4xl text-center">
            <div className="text-primary mb-8 flex justify-center">
              <div className="size-12 rounded-full border border-border flex items-center justify-center">
                <span className="font-serif italic text-2xl">"</span>
              </div>
            </div>
            <h2 className="text-3xl md:text-4xl font-medium tracking-tight mb-8 leading-snug">
              It's the first platform that doesn't treat my autistic son's learning style as a problem to be solved, but as a parameter to design around.
            </h2>
            <div className="flex items-center justify-center gap-4 text-left">
              <div className="size-12 rounded-full bg-secondary border border-border" />
              <div>
                <p className="font-semibold font-inter">Dr. Sarah Jenkins</p>
                <p className="text-sm text-muted-foreground font-inter">Parent & Special Education Director</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-12 border-t border-border bg-secondary/20">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="size-5 bg-foreground rounded-sm flex items-center justify-center">
              <div className="size-1.5 bg-background rounded-full" />
            </div>
            <span className="font-bold text-sm tracking-tight">AIVO</span>
          </div>
          <p className="text-sm text-muted-foreground font-inter">© 2024 Aivo Education. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
