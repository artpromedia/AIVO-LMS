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
  Building2,
  PlayCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import "./_group.css";

export function Web() {
  const [sensoryMode, setSensoryMode] = useState<"standard" | "calm" | "high-contrast">("standard");

  return (
    <div
      className={`aivo-inclusive-warm min-h-screen bg-background text-foreground transition-colors duration-500 font-sans ${
        sensoryMode === "calm"
          ? "sensory-calm"
          : sensoryMode === "high-contrast"
            ? "high-contrast"
            : ""
      }`}
    >
      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <a href="#" className="flex items-center" aria-label="Aivo Learning home">
              <img
                src="/__mockup/images/aivo-inclusive-warm/brand/aivo-logo-purple.png"
                alt="Aivo Learning"
                className="h-10 w-auto"
              />
            </a>
            <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
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

          <div className="flex items-center gap-6">
            <div className="hidden sm:flex items-center gap-1 bg-white/50 p-1.5 rounded-full border shadow-sm">
              <span className="text-xs font-semibold text-muted-foreground px-3 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" /> Mode
              </span>
              <div className="flex bg-muted/50 rounded-full p-0.5">
                {(["standard", "calm", "high-contrast"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSensoryMode(mode)}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${
                      sensoryMode === mode
                        ? "bg-white shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1).replace("-", " ")}
                  </button>
                ))}
              </div>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <Button variant="ghost" className="rounded-full font-medium">
                Log in
              </Button>
              <Button className="rounded-full bg-primary hover:bg-primary/90 font-medium px-6">
                Start Trial
              </Button>
            </div>
            <Button variant="ghost" size="icon" className="md:hidden rounded-full">
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="pt-24 pb-32 overflow-hidden relative">
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-[800px] h-[800px] bg-secondary/10 rounded-full blur-3xl -z-10"></div>
          <div className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl -z-10"></div>

          <div className="container mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
            <div className="max-w-2xl relative z-10">
              <Badge
                variant="outline"
                className="mb-8 py-2 px-4 rounded-full border-primary/20 bg-white/60 text-primary font-semibold shadow-sm backdrop-blur-sm"
              >
                <ShieldCheck className="w-4 h-4 mr-2" />
                FERPA & COPPA Compliant
              </Badge>
              <h1 className="aivo-display text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-8 text-foreground">
                Learning that{" "}
                <span className="relative inline-block px-2">
                  <span
                    className="relative z-10 bg-clip-text text-transparent"
                    style={{ backgroundImage: "linear-gradient(135deg, #3b82f6 0%, #a78bfa 100%)" }}
                  >
                    adapts
                  </span>
                  <span className="absolute bottom-2 left-0 w-full h-4 bg-[#c4b5fd]/50 -rotate-2 rounded-lg -z-0"></span>
                </span>{" "}
                to your child.
              </h1>
              <p className="text-xl text-muted-foreground mb-10 leading-relaxed font-medium">
                AIVO is the first AI learning platform engineered explicitly for neurodiverse
                cognitive profiles. We build a personalized "brain-clone" that models how your K-8
                child learns best.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  size="lg"
                  className="h-14 px-8 text-base rounded-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                >
                  Start Family Trial <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 px-8 text-base rounded-full bg-white/50 border-primary/20 hover:bg-white text-primary"
                >
                  <Building2 className="w-5 h-5 mr-2" />
                  For School Districts
                </Button>
              </div>
              <div className="mt-10 flex items-center gap-4 text-sm font-medium text-muted-foreground">
                <div className="flex -space-x-3">
                  <div className="w-10 h-10 rounded-full border-2 border-background bg-[#dbeafe] flex items-center justify-center text-[#1e40af] font-bold text-xs">
                    S
                  </div>
                  <div className="w-10 h-10 rounded-full border-2 border-background bg-[#fef3c7] flex items-center justify-center text-[#92400e] font-bold text-xs">
                    M
                  </div>
                  <div className="w-10 h-10 rounded-full border-2 border-background bg-[#ede9fe] flex items-center justify-center text-[#5b21b6] font-bold text-xs">
                    J
                  </div>
                </div>
                <p>Trusted by 1,200+ specialists and parents.</p>
              </div>
            </div>

            <div className="relative">
              <img
                src="/__mockup/images/aivo-inclusive-warm/hero-3d.png"
                alt="3D illustration of a child reading a glowing book"
                className="rounded-[2.5rem] shadow-2xl w-full object-cover border-4 border-white/40 rotate-1 transition-transform hover:rotate-0 duration-500"
              />

              {/* Floating Stat Card */}
              <Card className="absolute -bottom-8 -left-8 w-72 shadow-xl border-white/50 bg-white/90 backdrop-blur-md rounded-3xl p-1">
                <CardContent className="p-5 flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#dbeafe] flex items-center justify-center shrink-0">
                    <LineChart className="w-6 h-6 text-[#1d4ed8]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground mb-1">
                      Focus Duration
                    </p>
                    <p className="text-3xl font-extrabold tracking-tight text-[#1d4ed8]">+47.2%</p>
                    <p className="text-xs font-medium text-muted-foreground mt-1">
                      Average increase week 1
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Research Banner */}
        <section className="py-12 border-y border-border/50 bg-white/40">
          <div className="container mx-auto px-6">
            <p className="text-center text-sm font-bold tracking-widest text-muted-foreground uppercase mb-8">
              Methodology Built on Research From
            </p>
            <div className="flex flex-wrap justify-center gap-12 md:gap-24 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
              <span className="font-serif text-2xl font-bold">Stanford University</span>
              <span className="font-serif text-2xl font-bold">MIT Media Lab</span>
              <span className="font-sans text-2xl font-black uppercase tracking-tighter">CAST</span>
              <span className="font-serif text-2xl font-bold italic">Johns Hopkins</span>
            </div>
          </div>
        </section>

        {/* Philosophy */}
        <section className="py-32">
          <div className="container mx-auto px-6 grid md:grid-cols-2 gap-20 items-center">
            <div className="relative">
              <div className="absolute inset-0 bg-secondary/20 rounded-[3rem] transform -rotate-3 scale-105 -z-10"></div>
              <img
                src="/__mockup/images/aivo-inclusive-lab/hero-device.png"
                alt="AIVO interface"
                className="rounded-[2.5rem] shadow-xl w-full object-cover border-4 border-white"
              />
            </div>
            <div>
              <h2 className="text-4xl md:text-5xl font-bold mb-8 leading-tight">
                Engineered for the margins.
                <br />
                <span className="text-muted-foreground">Transformative for everyone.</span>
              </h2>
              <p className="text-xl text-muted-foreground mb-10 leading-relaxed font-medium">
                Most EdTech builds for the "average" student and patches on accessibility later. We
                started with the most complex cognitive profiles — autism, ADHD, sensory processing
                differences — and built an engine that dynamically scales to any mind.
              </p>

              <ul className="space-y-8">
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
                  <li key={i} className="flex gap-5">
                    <div className="mt-1 bg-secondary/20 p-3 rounded-2xl h-fit">
                      <CheckCircle2 className="w-6 h-6 text-secondary-foreground" />
                    </div>
                    <div>
                      <h3 className="font-bold text-xl mb-1">{feature.title}</h3>
                      <p className="text-muted-foreground font-medium">{feature.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-32 bg-white/50">
          <div className="container mx-auto px-6">
            <div className="flex flex-col items-center text-center mb-20">
              <Badge className="mb-6 py-1.5 px-4 rounded-full bg-secondary/20 text-secondary-foreground hover:bg-secondary/30 text-sm font-semibold">
                Family Evidence
              </Badge>
              <h2 className="text-4xl md:text-5xl font-bold">
                The relief of feeling{" "}
                <span className="relative inline-block px-1">
                  <span className="relative z-10">understood</span>
                  <span className="absolute bottom-1 left-0 w-full h-3 bg-secondary/40 rounded-lg -z-0"></span>
                </span>
                .
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-10 max-w-6xl mx-auto">
              <Card className="bg-card border-border/50 shadow-lg rounded-[2.5rem] p-4">
                <CardContent className="p-8">
                  <div className="flex gap-1.5 mb-6">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-secondary text-secondary" />
                    ))}
                  </div>
                  <p className="text-xl mb-8 leading-relaxed font-medium">
                    "My 8-year-old has profound ADHD and dyslexia. Every other app felt like a slot
                    machine — too loud, too fast. AIVO is the first platform that slows down when he
                    gets overwhelmed. It's not just a learning app, it's a regulated environment."
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-secondary/20 flex items-center justify-center font-bold text-lg text-secondary-foreground">
                      S.T.
                    </div>
                    <div>
                      <p className="font-bold text-lg">Sarah T.</p>
                      <p className="font-medium text-muted-foreground">Parent of 2</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border/50 shadow-lg rounded-[2.5rem] p-4">
                <CardContent className="p-8">
                  <div className="flex gap-1.5 mb-6">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-secondary text-secondary" />
                    ))}
                  </div>
                  <p className="text-xl mb-8 leading-relaxed font-medium">
                    "We use the 'Calm' sensory mode exclusively. For an autistic learner, removing
                    the visual clutter isn't a nice-to-have, it's the difference between learning
                    and melting down. The data tracking for his IEP is phenomenal."
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center font-bold text-lg text-primary">
                      M.R.
                    </div>
                    <div>
                      <p className="font-bold text-lg">Dr. Marcus R.</p>
                      <p className="font-medium text-muted-foreground">
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
        <section className="py-32">
          <div className="container mx-auto px-6">
            <Card className="bg-primary text-white shadow-2xl rounded-[3rem] overflow-hidden border-0 relative">
              <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
              <CardContent className="p-0 relative z-10">
                <div className="grid md:grid-cols-2">
                  <div className="p-16 md:p-24 flex flex-col justify-center">
                    <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
                      Ready to clone their brilliance?
                    </h2>
                    <p className="text-primary-foreground/80 mb-10 text-xl font-medium leading-relaxed">
                      Start with a comprehensive baseline assessment. No credit card required for
                      the first 14 days.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <Button
                        size="lg"
                        className="h-14 bg-secondary text-secondary-foreground hover:bg-secondary/90 rounded-full text-base font-bold shadow-lg px-8"
                      >
                        Start Family Trial
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        className="h-14 text-white border-white/30 hover:bg-white/10 rounded-full text-base font-semibold px-8"
                      >
                        Talk to District Sales
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-center p-16 relative">
                    <img
                      src="/__mockup/images/aivo-inclusive-warm/parent-child-3d.png"
                      alt="Parent and child 3D render"
                      className="w-full max-w-md object-contain drop-shadow-2xl rounded-[2rem] -rotate-3"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-white/50 pt-20 pb-12">
        <div className="container mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-12 mb-16">
          <div>
            <div className="flex items-center mb-6">
              <img
                src="/__mockup/images/aivo-inclusive-warm/brand/aivo-logo-purple.png"
                alt="Aivo Learning"
                className="h-9 w-auto"
              />
            </div>
            <p className="text-sm text-muted-foreground font-medium leading-relaxed">
              Engineered for the margins.
              <br />
              Transformative for everyone.
            </p>
          </div>
          <div>
            <h4 className="font-bold mb-6 text-foreground">Platform</h4>
            <ul className="space-y-3 text-sm font-medium text-muted-foreground">
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
            <h4 className="font-bold mb-6 text-foreground">Resources</h4>
            <ul className="space-y-3 text-sm font-medium text-muted-foreground">
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
            <h4 className="font-bold mb-6 text-foreground">Legal & Trust</h4>
            <ul className="space-y-3 text-sm font-medium text-muted-foreground">
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
        <div className="container mx-auto px-6 border-t border-border/50 pt-8 text-sm font-medium text-muted-foreground flex flex-col md:flex-row items-center justify-between">
          <p>© {new Date().getFullYear()} AIVO Learning Inc. All rights reserved.</p>
          <div className="flex items-center gap-2 mt-4 md:mt-0 bg-primary/5 px-4 py-2 rounded-full text-primary">
            <ShieldCheck className="w-4 h-4" />
            <span className="font-semibold">Secure & Compliant</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
