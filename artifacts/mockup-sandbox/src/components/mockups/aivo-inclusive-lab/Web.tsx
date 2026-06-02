import React, { useState } from "react";
import {
  ArrowRight,
  Brain,
  Settings2,
  Eye,
  ShieldCheck,
  BookOpen,
  LineChart,
  Menu,
  CheckCircle2,
  Star,
  Users,
  Building2,
  ChevronRight,
  PlayCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import "./_group.css";

export function Web() {
  const [sensoryMode, setSensoryMode] = useState<"standard" | "calm" | "high-contrast">("standard");

  const cycleSensoryMode = () => {
    setSensoryMode((prev) =>
      prev === "standard" ? "calm" : prev === "calm" ? "high-contrast" : "standard",
    );
  };

  return (
    <div
      className={`aivo-inclusive-lab min-h-screen bg-background text-foreground transition-colors duration-500 font-sans ${
        sensoryMode === "calm"
          ? "sensory-calm"
          : sensoryMode === "high-contrast"
            ? "high-contrast"
            : ""
      }`}
    >
      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <Brain className="w-8 h-8 text-primary" />
              <span className="text-xl font-bold tracking-tight">AIVO</span>
            </div>
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">
                Platform
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                Research
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                For Districts
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                Families
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 border rounded-full p-1 pl-3 bg-muted/30">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Eye className="w-3 h-3" /> View Mode
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={cycleSensoryMode}
                className="h-7 text-xs rounded-full bg-background shadow-sm border"
              >
                {sensoryMode === "standard"
                  ? "Standard"
                  : sensoryMode === "calm"
                    ? "Calm"
                    : "High Contrast"}
              </Button>
            </div>

            <div className="hidden md:flex items-center gap-2">
              <Button variant="ghost">Log in</Button>
              <Button>Start Trial</Button>
            </div>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="py-20 md:py-32 overflow-hidden relative">
          <div className="container mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center">
            <div className="max-w-2xl">
              <Badge
                variant="outline"
                className="mb-6 py-1.5 px-3 rounded-full border-primary/20 bg-primary/5 text-primary"
              >
                <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                FERPA & COPPA Compliant
              </Badge>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.1] mb-6">
                Learning that adapts to <span className="text-primary italic">their</span>{" "}
                neurology.
              </h1>
              <p className="text-xl text-muted-foreground mb-8 leading-relaxed max-w-xl">
                AIVO is the first AI learning platform engineered explicitly for neurodiverse
                cognitive profiles. We build a personalized "brain-clone" that models how your K-8
                child learns best.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="h-12 px-8 text-base">
                  For Families <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
                <Button size="lg" variant="outline" className="h-12 px-8 text-base bg-transparent">
                  <Building2 className="w-4 h-4 mr-2" />
                  For School Districts
                </Button>
              </div>
              <div className="mt-8 flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex -space-x-2">
                  <div className="w-8 h-8 rounded-full border-2 border-background bg-muted"></div>
                  <div className="w-8 h-8 rounded-full border-2 border-background bg-muted/80"></div>
                  <div className="w-8 h-8 rounded-full border-2 border-background bg-muted/60"></div>
                </div>
                <p>Trusted by 1,200+ specialists and parents.</p>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-secondary/10 rounded-[2rem] transform rotate-3 scale-105 -z-10"></div>
              <img
                src="/__mockup/images/aivo-inclusive-lab/hero-device.png"
                alt="AIVO interface showing clear, focused learning paths"
                className="rounded-2xl border shadow-2xl w-full object-cover"
              />

              {/* Floating Stat Card */}
              <Card className="absolute -bottom-6 -left-6 w-64 shadow-xl border-border/50 animate-in slide-in-from-bottom-4 fade-in duration-700 delay-300">
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <LineChart className="w-5 h-5 text-emerald-700" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Focus Duration</p>
                    <p className="text-2xl font-bold tracking-tight text-emerald-700">+47.2%</p>
                    <p className="text-xs text-muted-foreground mt-1">Average increase week 1</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Research Banner */}
        <section className="border-y bg-muted/30">
          <div className="container mx-auto px-4 py-8">
            <p className="text-center text-sm font-semibold tracking-wide text-muted-foreground uppercase mb-6">
              Methodology Built on Research From
            </p>
            <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
              <span className="font-serif text-xl font-bold">Stanford University</span>
              <span className="font-serif text-xl font-bold">MIT Media Lab</span>
              <span className="font-sans text-xl font-black uppercase tracking-tighter">CAST</span>
              <span className="font-serif text-xl font-bold italic">Johns Hopkins</span>
            </div>
          </div>
        </section>

        {/* Philosophy */}
        <section className="py-24">
          <div className="container mx-auto px-4 grid md:grid-cols-2 gap-16 items-center">
            <img
              src="/__mockup/images/aivo-inclusive-lab/parent-child.png"
              alt="Parent and child learning together"
              className="rounded-2xl w-full object-cover aspect-[4/3]"
            />
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Engineered for the margins.
                <br />
                <span className="text-muted-foreground">Transformative for everyone.</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Most EdTech builds for the "average" student and patches on accessibility later. We
                started with the most complex cognitive profiles — autism, ADHD, sensory processing
                differences — and built an engine that dynamically scales to any mind.
              </p>

              <ul className="space-y-6">
                {[
                  {
                    title: "14 Specialized AI Tutors",
                    desc: "From highly-structured explicit instruction to open-ended exploratory dialog.",
                  },
                  {
                    title: "5 Functioning Levels",
                    desc: "Content complexity decoupled from interface complexity.",
                  },
                  {
                    title: "Sensory-First Design",
                    desc: "First-class controls for visual noise, contrast, and cognitive load.",
                  },
                ].map((feature, i) => (
                  <li key={i} className="flex gap-4">
                    <div className="mt-1 bg-primary/10 p-2 rounded-full h-fit">
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{feature.title}</h3>
                      <p className="text-muted-foreground">{feature.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Feature Deep Dive */}
        <section className="py-24 bg-primary text-primary-foreground">
          <div className="container mx-auto px-4 text-center max-w-3xl mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">The Cognitive Engine</h2>
            <p className="text-primary-foreground/80 text-lg">
              Behind the calm interface is a sophisticated system analyzing 40+ learning vectors per
              minute.
            </p>
          </div>

          <div className="container mx-auto px-4 grid md:grid-cols-3 gap-8">
            <Card className="bg-primary-foreground/5 border-primary-foreground/10 text-primary-foreground backdrop-blur">
              <CardContent className="p-8">
                <Settings2 className="w-10 h-10 mb-6 text-secondary" />
                <h3 className="text-xl font-semibold mb-3">Adaptive Pacing</h3>
                <p className="text-primary-foreground/70">
                  Detects frustration markers before the learner does, automatically shifting from
                  active learning to consolidation phases.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-primary-foreground/5 border-primary-foreground/10 text-primary-foreground backdrop-blur">
              <CardContent className="p-8">
                <Brain className="w-10 h-10 mb-6 text-secondary" />
                <h3 className="text-xl font-semibold mb-3">Working Memory Support</h3>
                <p className="text-primary-foreground/70">
                  Information is chunked dynamically. Key context persists on screen. Multi-step
                  instructions are automatically broken down.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-primary-foreground/5 border-primary-foreground/10 text-primary-foreground backdrop-blur">
              <CardContent className="p-8">
                <BookOpen className="w-10 h-10 mb-6 text-secondary" />
                <h3 className="text-xl font-semibold mb-3">Interest Integration</h3>
                <p className="text-primary-foreground/70">
                  Math problems automatically rewrite themselves to feature the learner's current
                  hyper-fixations (trains, dinosaurs, space).
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-24 bg-muted/20">
          <div className="container mx-auto px-4">
            <div className="flex flex-col items-center text-center mb-16">
              <Badge className="mb-4">Family Evidence</Badge>
              <h2 className="text-3xl md:text-4xl font-bold">The relief of feeling understood.</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              <Card className="bg-background border-border shadow-sm">
                <CardContent className="p-8">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-secondary text-secondary" />
                    ))}
                  </div>
                  <p className="text-lg mb-6 leading-relaxed">
                    "My 8-year-old has profound ADHD and dyslexia. Every other app felt like a slot
                    machine — too loud, too fast. AIVO is the first platform that slows down when he
                    gets overwhelmed. It's not just a learning app, it's a regulated environment."
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold">
                      S.T.
                    </div>
                    <div>
                      <p className="font-semibold">Sarah T.</p>
                      <p className="text-sm text-muted-foreground">Parent of 2</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-background border-border shadow-sm">
                <CardContent className="p-8">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-secondary text-secondary" />
                    ))}
                  </div>
                  <p className="text-lg mb-6 leading-relaxed">
                    "We use the 'Calm' sensory mode exclusively. For an autistic learner, removing
                    the visual clutter isn't a nice-to-have, it's the difference between learning
                    and melting down. The data tracking for his IEP is phenomenal."
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold">
                      M.R.
                    </div>
                    <div>
                      <p className="font-semibold">Dr. Marcus R.</p>
                      <p className="text-sm text-muted-foreground">
                        Special Education Director & Parent
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24">
          <div className="container mx-auto px-4">
            <Card className="bg-primary text-primary-foreground overflow-hidden border-0">
              <CardContent className="p-0">
                <div className="grid md:grid-cols-2">
                  <div className="p-12 md:p-16 flex flex-col justify-center">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">
                      Ready to clone their brilliance?
                    </h2>
                    <p className="text-primary-foreground/80 mb-8 text-lg">
                      Start with a comprehensive baseline assessment. No credit card required for
                      the first 14 days.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <Button size="lg" className="bg-white text-primary hover:bg-white/90">
                        Start Family Trial
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        className="text-white border-white/20 hover:bg-white/10"
                      >
                        Talk to District Sales
                      </Button>
                    </div>
                  </div>
                  <div className="bg-primary-foreground/5 flex items-center justify-center p-12 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
                    <img
                      src="/__mockup/images/aivo-inclusive-lab/companion.png"
                      alt="AIVO digital companion"
                      className="w-48 h-48 object-contain drop-shadow-2xl"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/10 py-12">
        <div className="container mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <Brain className="w-6 h-6 text-primary" />
              <span className="text-lg font-bold">AIVO</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Engineered for the margins.
              <br />
              Transformative for everyone.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Platform</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="#" className="hover:text-primary transition-colors">
                  How it works
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-primary transition-colors">
                  Sensory controls
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-primary transition-colors">
                  Pricing
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Resources</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="#" className="hover:text-primary transition-colors">
                  Research library
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-primary transition-colors">
                  IEP integration
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-primary transition-colors">
                  Blog
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Legal & Trust</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="#" className="hover:text-primary transition-colors">
                  Privacy policy
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-primary transition-colors">
                  FERPA compliance
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-primary transition-colors">
                  COPPA compliance
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="container mx-auto px-4 border-t pt-8 text-sm text-muted-foreground flex flex-col md:flex-row items-center justify-between">
          <p>© {new Date().getFullYear()} AIVO Learning Inc. All rights reserved.</p>
          <div className="flex items-center gap-4 mt-4 md:mt-0">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-4 h-4" /> Secure & Compliant
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
