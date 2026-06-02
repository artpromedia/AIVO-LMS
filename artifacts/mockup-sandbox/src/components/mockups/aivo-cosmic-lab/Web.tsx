import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Brain,
  ShieldCheck,
  Microscope,
  ArrowRight,
  ChevronRight,
  BookOpen,
  Star,
} from "lucide-react";
import "./_group.css";

export function Web() {
  return (
    <div className="cosmic-theme min-h-screen w-full overflow-x-hidden flex flex-col font-sans text-foreground selection:bg-primary/30">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass-panel border-b-0 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary animate-pulse" />
            <span className="font-display font-bold text-2xl tracking-tight text-white">AIVO</span>
          </div>

          <div className="hidden md:flex items-center gap-8 font-medium text-sm text-muted-foreground">
            <a href="#" className="hover:text-primary transition-colors">
              For Parents
            </a>
            <a href="#" className="hover:text-primary transition-colors">
              For Districts
            </a>
            <a href="#" className="hover:text-primary transition-colors">
              The Science
            </a>
            <a href="#" className="hover:text-primary transition-colors">
              About Us
            </a>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" className="text-white hover:text-primary hidden md:inline-flex">
              Log In
            </Button>
            <Button className="font-display font-medium tracking-wide bg-primary/90 hover:bg-primary text-primary-foreground border-none">
              Start the Journey
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-6 overflow-hidden bg-aurora">
        {/* Subtle decorative background elements */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] [mask-image:linear-gradient(to_bottom,white,transparent)]"></div>

        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center relative z-10">
          <div className="max-w-2xl">
            <Badge
              variant="outline"
              className="mb-6 font-display border-primary/30 text-primary bg-primary/5 py-1 px-3"
            >
              <Microscope className="w-3 h-3 mr-2" />
              Research-Backed Adaptive Learning
            </Badge>

            <h1 className="font-display text-5xl md:text-7xl font-bold text-white leading-[1.1] mb-6 tracking-tight">
              A mind is a universe. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
                Let's map it.
              </span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed max-w-lg">
              AIVO pairs neurodiverse children with 14 specialized AI tutors that adapt to their
              unique functioning level. Not just an app—a glowing constellation of learning that
              grows with them.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                className="font-display text-lg bg-primary hover:bg-primary/90 text-primary-foreground border-none px-8"
              >
                Explore the Platform <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="font-display text-lg border-muted-foreground/30 text-white hover:bg-white/5"
              >
                Read the Methodology
              </Button>
            </div>

            <div className="mt-10 flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full border border-background bg-muted flex items-center justify-center overflow-hidden"
                  >
                    <img
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=parent${i}&backgroundColor=1e2337`}
                      alt="Parent avatar"
                      className="w-full h-full opacity-80"
                    />
                  </div>
                ))}
              </div>
              <p>Trusted by 10,000+ parents and 50+ school districts.</p>
            </div>
          </div>

          <div className="relative aspect-square md:aspect-[4/3] w-full max-w-lg mx-auto">
            <div className="absolute inset-0 rounded-2xl overflow-hidden glass-panel animate-pulse-glow">
              <img
                src="/__mockup/images/aivo-cosmic-lab/hero.png"
                alt="A soft glowing constellation that forms the shape of a child's brain"
                className="w-full h-full object-cover opacity-90 mix-blend-screen"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent"></div>

              {/* Floating UI Elements */}
              <div className="absolute bottom-6 left-6 right-6 glass-panel rounded-xl p-4 flex items-center gap-4 animate-float">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <Brain className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white font-display">Brain-Clone Synced</p>
                  <p className="text-xs text-primary">
                    Adapting to visual-spatial learning style...
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Concept Section */}
      <section className="py-24 px-6 relative bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="font-display text-3xl md:text-5xl font-bold text-white mb-6">
              The Digital Brain-Clone
            </h2>
            <p className="text-muted-foreground text-lg">
              Every child processes the world differently. AIVO creates a secure, private
              computational model of how your child learns best—mapping their strengths, sensory
              preferences, and cognitive patterns.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: "14 Specialized Tutors",
                desc: "From math and reading to executive function and emotional regulation. Each tutor speaks to your child in the exact way they understand.",
                icon: <Star className="w-6 h-6 text-primary" />,
                delay: "0ms",
              },
              {
                title: "5 Functioning Levels",
                desc: "Content seamlessly adapts from standard curriculum down to pre-symbolic communication, ensuring no child is left behind.",
                icon: <BookOpen className="w-6 h-6 text-secondary" />,
                delay: "100ms",
              },
              {
                title: "Sensory-Aware Design",
                desc: "A calm, predictable environment. No harsh flashing, no stressful timers, just intentional motion and gentle encouragement.",
                icon: <ShieldCheck className="w-6 h-6 text-primary" />,
                delay: "200ms",
              },
            ].map((feature, i) => (
              <Card key={i} className="bg-card/50 border-white/5 glass-panel overflow-hidden group">
                <CardContent className="p-8">
                  <div className="w-12 h-12 rounded-xl bg-background/80 border border-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                    {feature.icon}
                  </div>
                  <h3 className="font-display text-xl font-bold text-white mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Visual Showcase */}
      <section className="py-24 px-6 relative overflow-hidden bg-[#0b0f19]">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div className="order-2 md:order-1 relative rounded-2xl overflow-hidden glass-panel border-secondary/20 animate-pulse-glow-magenta p-2">
            <div className="rounded-xl overflow-hidden">
              <img
                src="/__mockup/images/aivo-cosmic-lab/tutor-hub.png"
                alt="Cosmic specialized AI tutors"
                className="w-full h-auto object-cover opacity-80"
              />
            </div>
          </div>

          <div className="order-1 md:order-2">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-6">
              A universe of guidance,
              <br />
              orchestrated for one.
            </h2>
            <p className="text-muted-foreground text-lg mb-8">
              While the child interacts with friendly, celestial guides, the AIVO engine is
              continuously analyzing response times, error patterns, and engagement metrics.
            </p>
            <ul className="space-y-4 mb-8">
              {[
                "Real-time IEP alignment and progress tracking",
                "Automated state-standard compliance for districts",
                "Detailed, actionable insights for parents and care teams",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="mt-1 bg-primary/20 rounded-full p-1">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-foreground">{item}</span>
                </li>
              ))}
            </ul>
            <Button variant="link" className="text-primary font-display p-0 h-auto text-lg">
              View the District Dashboard <ChevronRight className="ml-1 w-5 h-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer / CTA */}
      <section className="py-24 px-6 relative bg-gradient-to-b from-background to-[#0b0f19]">
        <div className="max-w-4xl mx-auto text-center glass-panel rounded-3xl p-12 border-primary/20 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent"></div>

          <Brain className="w-12 h-12 text-primary mx-auto mb-6 opacity-80" />
          <h2 className="font-display text-3xl md:text-5xl font-bold text-white mb-6">
            Ready to map their potential?
          </h2>
          <p className="text-muted-foreground text-lg mb-10 max-w-2xl mx-auto">
            Join the parents and educators who are transforming how neurodiverse minds learn, grow,
            and thrive.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button
              size="lg"
              className="font-display text-lg bg-primary hover:bg-primary/90 text-primary-foreground border-none"
            >
              Start Free Trial
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="font-display text-lg border-muted-foreground/30 text-white"
            >
              Schedule District Demo
            </Button>
          </div>
        </div>
      </section>

      <footer className="py-8 border-t border-white/5 text-center text-muted-foreground text-sm">
        <p>© 2024 AIVO Learning. Designed for every mind.</p>
      </footer>
    </div>
  );
}
