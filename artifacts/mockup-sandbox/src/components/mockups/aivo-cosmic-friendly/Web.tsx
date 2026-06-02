import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Brain,
  ShieldCheck,
  Star,
  ArrowRight,
  Heart,
  BookOpen,
  Compass,
  Activity,
  Play,
  CheckCircle2,
} from "lucide-react";
import "./_group.css";

export function Web() {
  return (
    <div className="cosmic-friendly min-h-screen w-full overflow-x-hidden flex flex-col font-sans selection:bg-primary/20">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass-panel border-b-0 px-6 py-4 transition-all duration-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
              <Sparkles className="w-6 h-6" />
            </div>
            <span className="font-display font-bold text-3xl tracking-tight text-foreground">
              AIVO
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8 font-medium text-foreground/80">
            <a href="#" className="hover:text-primary transition-colors">
              For Parents
            </a>
            <a href="#" className="hover:text-primary transition-colors">
              For Schools
            </a>
            <a href="#" className="hover:text-primary transition-colors">
              The Science
            </a>
            <a href="#" className="hover:text-primary transition-colors">
              Our Story
            </a>
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              className="text-foreground font-medium hidden md:inline-flex hover:bg-primary/5 hover:text-primary"
            >
              Log In
            </Button>
            <Button className="font-display font-semibold tracking-wide bg-primary hover:bg-primary/90 text-white rounded-full px-6 py-5 shadow-lg shadow-primary/25 border-none transition-all hover:scale-105 active:scale-95">
              Start Free Trial
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 md:pt-40 md:pb-32 px-6 overflow-hidden bg-dawn-sky min-h-[95vh] flex items-center">
        {/* Subtle decorative background elements - Constellations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="glowing-star top-[20%] left-[15%] animate-pulse-soft"></div>
          <div className="glowing-star top-[15%] left-[25%] opacity-50"></div>
          <div className="glowing-star top-[35%] left-[10%] opacity-70"></div>
          <div
            className="glowing-star top-[10%] right-[20%] animate-pulse-soft"
            style={{ animationDelay: "1s" }}
          ></div>
          <div className="glowing-star top-[25%] right-[10%] opacity-60"></div>
        </div>

        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center relative z-10 w-full">
          <div className="max-w-2xl">
            <Badge className="mb-6 font-display border-white/40 text-white bg-white/20 hover:bg-white/30 backdrop-blur-md py-1.5 px-4 rounded-full">
              <Sparkles className="w-4 h-4 mr-2" />
              Research-Backed & Sensory-Safe
            </Badge>

            <h1 className="font-display text-5xl md:text-7xl font-bold text-white leading-[1.1] mb-6 tracking-tight">
              A mind is a universe. <br />
              <span className="text-[#FEF3C7]">Let's map it.</span>
            </h1>

            <p className="text-xl text-white/90 mb-10 leading-relaxed max-w-lg font-medium">
              The first adaptive AI learning platform designed for neurodiverse kids. No ticking
              clocks. No harsh flashing. Just a patient companion that learns exactly how your child
              learns best.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                className="font-display text-lg bg-white hover:bg-white/90 text-primary border-none px-8 rounded-full h-14 shadow-xl"
              >
                Meet Your AIVO <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="font-display text-lg border-white/30 text-white hover:bg-white/10 rounded-full h-14 backdrop-blur-sm"
              >
                <Play className="mr-2 w-5 h-5" fill="currentColor" /> See How It Works
              </Button>
            </div>

            <div className="mt-12 flex items-center gap-4 text-sm font-semibold text-white/80">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-10 h-10 rounded-full border-2 border-[#818CF8] bg-white/20 backdrop-blur-md flex items-center justify-center overflow-hidden"
                  >
                    <img
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=family${i}&backgroundColor=transparent`}
                      alt="Parent avatar"
                      className="w-full h-full opacity-90"
                    />
                  </div>
                ))}
              </div>
              <p>Trusted by 10,000+ parents and 50+ school districts.</p>
            </div>
          </div>

          <div className="relative flex justify-center md:justify-end mt-10 md:mt-0">
            <div className="relative w-full max-w-[500px] aspect-square">
              {/* Main Image Container */}
              <div className="absolute inset-0 rounded-[3rem] overflow-hidden glass-panel-dark animate-float-slow p-2 border-white/40 shadow-2xl">
                <div className="w-full h-full rounded-[2.5rem] overflow-hidden relative bg-[#4F46E5]/20">
                  <img
                    src="/__mockup/images/aivo-cosmic-friendly/hero-brain.png"
                    alt="A soft glowing constellation that forms the shape of a child's brain"
                    className="w-full h-full object-cover mix-blend-screen opacity-90"
                  />
                </div>
              </div>

              {/* Floating UI Elements */}
              <div className="absolute -bottom-6 -left-6 glass-panel rounded-2xl p-5 flex items-center gap-4 animate-float shadow-xl border-white/50 backdrop-blur-xl">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                  <Brain className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground font-display">
                    Brain-Clone Synced
                  </p>
                  <p className="text-xs text-muted-foreground font-medium">
                    Adapting to visual-spatial learning...
                  </p>
                </div>
              </div>

              <div
                className="absolute top-12 -right-8 glass-panel rounded-2xl p-4 flex items-center gap-3 animate-float shadow-xl border-white/50 backdrop-blur-xl"
                style={{ animationDelay: "1.5s" }}
              >
                <div className="w-10 h-10 rounded-full bg-accent/30 flex items-center justify-center text-accent-foreground">
                  <Heart className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground font-display">Calm Environment</p>
                  <p className="text-[10px] text-muted-foreground font-medium">
                    Sensory mode active
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Curved bottom edge to transition smoothly into next section */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg
            viewBox="0 0 1440 120"
            fill="none"
            xmlns="http://www.w3.org/2000/org/2000/svg"
            className="w-full h-auto text-background"
          >
            <path
              d="M0 120L1440 120L1440 0C1440 0 1066.67 110 720 110C373.333 110 0 0 0 0L0 120Z"
              fill="currentColor"
            />
          </svg>
        </div>
      </section>

      {/* Concept Section */}
      <section className="py-24 px-6 relative bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <Badge
              variant="outline"
              className="mb-4 text-primary border-primary/30 bg-primary/5 px-4 py-1.5 rounded-full text-sm font-semibold"
            >
              The Digital Brain-Clone
            </Badge>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-6">
              An AI that learns <br />
              <span className="text-primary relative inline-block">
                how your child learns.
                <svg
                  className="absolute w-full h-3 -bottom-1 left-0 text-accent/60"
                  viewBox="0 0 100 10"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M0 5 Q 50 10 100 5"
                    stroke="currentColor"
                    strokeWidth="6"
                    fill="transparent"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h2>
            <p className="text-muted-foreground text-xl font-medium leading-relaxed">
              Every child processes the world differently. AIVO creates a secure, private
              computational model of your child's unique cognitive profile—mapping their strengths,
              sensory preferences, and learning pace.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: "14 Specialized Tutors",
                desc: "From math and reading to executive function and emotional regulation. Each tutor speaks to your child in the exact way they understand.",
                icon: <Star className="w-7 h-7 text-primary" />,
                bg: "bg-primary/10",
              },
              {
                title: "Sensory-Safe Design",
                desc: "A calm, predictable environment. Muted color palettes, gentle transitions, and zero unexpected loud noises or stressful timers.",
                icon: <ShieldCheck className="w-7 h-7 text-[#F59E0B]" />,
                bg: "bg-[#FFEDD5]",
              },
              {
                title: "Strengths-First Learning",
                desc: "We focus on what your child loves. If they're fascinated by space, our tutors teach math, reading, and science entirely through the lens of stars.",
                icon: <Compass className="w-7 h-7 text-accent" />,
                bg: "bg-accent/20",
              },
            ].map((feature, i) => (
              <Card
                key={i}
                className="bg-white border-border/50 soft-shadow rounded-[2rem] overflow-hidden group hover:-translate-y-2 transition-transform duration-300"
              >
                <CardContent className="p-8 md:p-10">
                  <div
                    className={`w-16 h-16 rounded-2xl ${feature.bg} flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500`}
                  >
                    {feature.icon}
                  </div>
                  <h3 className="font-display text-2xl font-bold text-foreground mb-4">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed text-lg font-medium">
                    {feature.desc}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Visual Showcase */}
      <section className="py-24 px-6 relative overflow-hidden bg-white border-y border-border/50">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div className="order-2 md:order-1 relative rounded-[3rem] overflow-hidden bg-dawn-sky p-1 shadow-2xl">
            <div className="rounded-[2.8rem] overflow-hidden bg-white/20 backdrop-blur-sm">
              <img
                src="/__mockup/images/aivo-cosmic-friendly/mascot.png"
                alt="AIVO friendly cosmic mascot"
                className="w-full h-auto object-cover opacity-90 p-8 animate-float"
              />
            </div>
          </div>

          <div className="order-1 md:order-2">
            <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-6 leading-tight">
              A universe of guidance,
              <br />
              orchestrated for one.
            </h2>
            <p className="text-muted-foreground text-xl mb-10 font-medium leading-relaxed">
              While your child interacts with friendly, celestial guides, the AIVO engine
              continuously analyzes response times, error patterns, and engagement metrics to adapt
              the next lesson perfectly.
            </p>
            <ul className="space-y-6 mb-10">
              {[
                "Real-time IEP alignment and progress tracking",
                "Automated state-standard compliance for districts",
                "Detailed, actionable insights for parents and care teams",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-4">
                  <div className="mt-1 bg-primary/10 rounded-full p-1 text-primary">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <span className="text-foreground text-lg font-medium">{item}</span>
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              className="text-primary font-display font-semibold border-primary/20 hover:bg-primary/5 rounded-full px-6 py-6 text-lg h-auto"
            >
              View the District Dashboard <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer / CTA */}
      <section className="py-32 px-6 relative bg-dawn-sky overflow-hidden">
        {/* Subtle decorative background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none mix-blend-overlay opacity-30">
          <div className="glowing-star top-[20%] left-[15%]"></div>
          <div className="glowing-star top-[60%] left-[85%]"></div>
          <div className="glowing-star top-[80%] left-[20%]"></div>
          <div className="glowing-star top-[30%] left-[80%]"></div>
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="glass-panel-dark rounded-[3rem] p-12 md:p-20 shadow-2xl border-white/30 backdrop-blur-xl">
            <div className="w-20 h-20 bg-white/20 rounded-3xl mx-auto mb-8 flex items-center justify-center backdrop-blur-md border border-white/40">
              <Brain className="w-10 h-10 text-white" />
            </div>
            <h2 className="font-display text-4xl md:text-6xl font-bold text-white mb-6 tracking-tight">
              Ready to map their potential?
            </h2>
            <p className="text-white/90 text-xl md:text-2xl mb-12 max-w-2xl mx-auto font-medium leading-relaxed">
              Join the parents and educators who are transforming how neurodiverse minds learn,
              grow, and thrive.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button
                size="lg"
                className="font-display text-xl bg-white hover:bg-white/90 text-primary border-none rounded-full h-16 px-10 shadow-xl transition-transform hover:scale-105 active:scale-95"
              >
                Start Free Trial
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="font-display text-xl border-white/30 text-white hover:bg-white/10 rounded-full h-16 px-10 backdrop-blur-sm"
              >
                Schedule District Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-white py-12 px-6 border-t border-border text-center">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 text-foreground font-display font-bold text-xl">
            <Sparkles className="w-5 h-5 text-primary" />
            AIVO
          </div>
          <div className="flex gap-6 text-muted-foreground font-medium text-sm">
            <a href="#" className="hover:text-primary transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-primary transition-colors">
              Terms of Service
            </a>
            <a href="#" className="hover:text-primary transition-colors">
              Contact
            </a>
          </div>
          <p className="text-muted-foreground text-sm font-medium">
            © 2024 AIVO Learning. Designed for every mind.
          </p>
        </div>
      </footer>
    </div>
  );
}
