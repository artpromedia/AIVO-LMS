import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, BookOpen, Brain, CheckCircle2, ChevronRight, Eye, Moon, Settings, Shield, Sparkles } from "lucide-react";
import "./_group.css";

export function Web() {
  const [sensoryMode, setSensoryMode] = useState<"standard" | "calm">("standard");

  return (
    <div className={`aivo-editorial-calm min-h-screen flex flex-col transition-colors duration-500 ${sensoryMode === "calm" ? "bg-[#F4F1ED]" : ""}`}>
      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <span className="font-serif text-2xl font-bold tracking-tight">AIVO</span>
            <nav className="hidden md:flex gap-6 text-sm font-medium text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Platform</a>
              <a href="#" className="hover:text-foreground transition-colors">Research</a>
              <a href="#" className="hover:text-foreground transition-colors">For Districts</a>
              <a href="#" className="hover:text-foreground transition-colors">Families</a>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 border-r border-border pr-4 mr-2">
              <span className="text-xs text-muted-foreground">Sensory Mode</span>
              <button 
                onClick={() => setSensoryMode(s => s === "standard" ? "calm" : "standard")}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                  sensoryMode === "calm" ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground"
                }`}
                aria-label="Toggle calm sensory mode"
              >
                <Moon className="w-3.5 h-3.5" />
                Calm
              </button>
            </div>
            <a href="#" className="text-sm font-medium hidden sm:block">Log in</a>
            <Button className="bg-foreground text-background hover:bg-foreground/90 rounded-full px-6">
              Start Free Trial
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative pt-24 pb-32 overflow-hidden">
          <div className="container mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div className="max-w-2xl">
                <Badge variant="outline" className="mb-6 rounded-full px-3 py-1 font-normal border-border bg-background">
                  <Shield className="w-3.5 h-3.5 mr-2 text-primary" />
                  FERPA & COPPA Compliant
                </Badge>
                <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-light leading-[1.1] mb-8 text-foreground">
                  An education that adapts to <span className="italic text-primary">their</span> mind.
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-10 max-w-xl font-light">
                  AIVO provides every K-8 child with a personal learning companion that understands how they process the world. Designed with neurodiverse families in mind, built for every learner.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button size="lg" className="rounded-full text-base px-8 bg-primary hover:bg-primary/90 border-transparent">
                    Meet Your Tutor
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  <Button size="lg" variant="outline" className="rounded-full text-base px-8 border-border hover:bg-secondary">
                    Read the Research
                  </Button>
                </div>
              </div>
              <div className="relative">
                <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl relative">
                  <img 
                    src="/__mockup/images/aivo-editorial-calm/hero.png" 
                    alt="Mother and child learning together in a calm environment" 
                    className="object-cover w-full h-full"
                  />
                  <div className="absolute inset-0 ring-1 ring-inset ring-black/10 rounded-2xl"></div>
                </div>
                <div className="absolute -bottom-8 -left-8 bg-card p-6 rounded-xl shadow-xl border border-border/50 max-w-xs">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                      <Brain className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Adapting approach...</p>
                      <p className="text-xs text-muted-foreground mt-1">Switching to visual-first explanations for spatial reasoning concept.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Philosophy / Features */}
        <section className="py-24 bg-secondary/30">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl mx-auto text-center mb-20">
              <h2 className="font-serif text-3xl md:text-4xl font-light mb-6">Learning shouldn't hurt.</h2>
              <p className="text-lg text-muted-foreground font-light leading-relaxed">
                Traditional education demands that children adapt to the curriculum. AIVO demands that the curriculum adapts to the child. Built on foundational research from MIT and Stanford.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-12">
              {[
                {
                  icon: <Eye className="w-6 h-6 text-primary" />,
                  title: "Sensory-First Design",
                  desc: "Low-contrast modes, predictable animations, and a strict no-urgency environment. We remove the cognitive load of the interface."
                },
                {
                  icon: <Brain className="w-6 h-6 text-accent" />,
                  title: "Cognitive Modeling",
                  desc: "AIVO builds a 'brain-clone' mapping 14 distinct dimensions of your child's learning style, identifying exact friction points."
                },
                {
                  icon: <Settings className="w-6 h-6 text-foreground" />,
                  title: "Deep Pacing Control",
                  desc: "No timers. No artificial pressure. 5 functioning levels that automatically adjust text complexity without changing the underlying concepts."
                }
              ].map((feature, i) => (
                <div key={i} className="flex flex-col">
                  <div className="w-12 h-12 rounded-full bg-background border border-border flex items-center justify-center mb-6">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-serif font-medium mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed flex-grow">
                    {feature.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Product UI Showcase */}
        <section className="py-32">
          <div className="container mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-20 items-center">
              <div className="order-2 lg:order-1 relative">
                <div className="absolute inset-0 bg-secondary rounded-[2.5rem] transform -rotate-3 scale-105 opacity-50"></div>
                <div className="relative bg-card border border-border/60 rounded-3xl shadow-2xl p-8 max-w-md mx-auto z-10">
                  {/* Fake UI */}
                  <div className="space-y-6">
                    <header className="flex justify-between items-center mb-8">
                      <div>
                        <h4 className="font-serif text-xl">Good morning, Leo.</h4>
                        <p className="text-sm text-muted-foreground">Today's pace: Gentle</p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-muted overflow-hidden flex items-center justify-center text-sm font-medium">L</div>
                    </header>

                    <div className="p-5 rounded-2xl bg-secondary/50 border border-border/50">
                      <div className="flex items-center gap-3 mb-4">
                        <BookOpen className="w-5 h-5 text-primary" />
                        <span className="font-medium">Current Focus</span>
                      </div>
                      <h5 className="font-serif text-lg mb-2">Fractions & Sharing</h5>
                      <p className="text-sm text-muted-foreground mb-4">We noticed you like pizza examples. Let's look at how to share one.</p>
                      <div className="w-full bg-background rounded-full h-2 mb-2">
                        <div className="bg-primary h-2 rounded-full w-2/3"></div>
                      </div>
                      <span className="text-xs font-medium text-primary">65% understood</span>
                    </div>

                    <div className="space-y-3">
                      <h6 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Your Team</h6>
                      {[
                        { name: "Prof. Oak", role: "Math Guide", status: "Ready" },
                        { name: "Aura", role: "Reading Support", status: "Resting" }
                      ].map((tutor, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-border/40">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <Sparkles className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{tutor.name}</p>
                              <p className="text-xs text-muted-foreground">{tutor.role}</p>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">{tutor.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="order-1 lg:order-2">
                <h2 className="font-serif text-3xl md:text-5xl font-light mb-6">Designed for dignity.</h2>
                <p className="text-lg text-muted-foreground font-light leading-relaxed mb-8">
                  We don't use patronizing cartoons or flashing rewards to hold attention. AIVO respects your child's intelligence by offering a clean, beautiful interface that reduces anxiety and elevates focus.
                </p>
                <ul className="space-y-4 mb-10">
                  {[
                    "14 specialized AI tutors that adapt tone and vocabulary",
                    "Detailed progress reports translated into IEP-ready language",
                    "Audio-first, text-first, or visual-first modes",
                    "Zero punitive mechanics for incorrect answers"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
                <a href="#" className="inline-flex items-center font-medium text-primary hover:text-primary/80 transition-colors">
                  Explore the learner experience <ChevronRight className="w-4 h-4 ml-1" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonial */}
        <section className="py-24 bg-foreground text-background">
          <div className="container mx-auto px-6">
            <div className="max-w-4xl mx-auto text-center">
              <Sparkles className="w-8 h-8 text-primary mx-auto mb-8 opacity-70" />
              <blockquote className="font-serif text-2xl md:text-4xl font-light leading-tight mb-10">
                "We tried six different platforms for my son, who has ADHD and sensory processing differences. Everything was too loud, too fast, or treated him like a baby. AIVO is the first tool that feels like it respects him."
              </blockquote>
              <div className="flex items-center justify-center gap-4">
                <div className="w-12 h-12 rounded-full overflow-hidden">
                  <img src="/__mockup/images/aivo-editorial-calm/feature-play.png" alt="Parent" className="w-full h-full object-cover" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Sarah Jenkins</div>
                  <div className="text-sm text-muted-foreground">Parent of a 3rd Grader</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-12 border-t border-border mt-auto">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2">
              <span className="font-serif text-2xl font-bold tracking-tight mb-4 block">AIVO</span>
              <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                Adaptive learning for the neurodiverse mind. Dignified education for every child.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-4">Platform</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">For Families</a></li>
                <li><a href="#" className="hover:text-foreground">For Schools & Districts</a></li>
                <li><a href="#" className="hover:text-foreground">Specialists & IEPs</a></li>
                <li><a href="#" className="hover:text-foreground">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-4">Research</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Methodology</a></li>
                <li><a href="#" className="hover:text-foreground">Efficacy Studies</a></li>
                <li><a href="#" className="hover:text-foreground">Privacy & Security</a></li>
                <li><a href="#" className="hover:text-foreground">Trust Center</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <p>© {new Date().getFullYear()} AIVO Learning Inc. All rights reserved.</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-foreground">Terms of Service</a>
              <a href="#" className="hover:text-foreground">Privacy Policy</a>
              <a href="#" className="hover:text-foreground">Accessibility</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
