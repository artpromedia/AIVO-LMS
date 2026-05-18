import React, { useEffect, useRef } from "react";
import { ArrowRight, Brain, Heart, Shield, Users, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import "./_group.css";

// Helper components
const Section = ({
  children,
  bg = "bg-background",
}: {
  children: React.ReactNode;
  bg?: string;
}) => (
  <section className={`min-h-[100dvh] flex flex-col justify-center snap-start py-20 px-6 ${bg}`}>
    <div className="max-w-3xl mx-auto w-full">{children}</div>
  </section>
);

export function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans scroll-snap-y h-screen overflow-y-auto">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 p-6 flex justify-between items-center pointer-events-none">
        <div className="text-2xl font-bold tracking-tight text-primary pointer-events-auto">
          AIVO
        </div>
        <Button
          variant="outline"
          className="pointer-events-auto rounded-full px-6 border-border bg-background/80 backdrop-blur-md"
        >
          Log In
        </Button>
      </nav>

      {/* Hero Section */}
      <Section>
        <div className="flex flex-col gap-8 text-left pt-12">
          <Badge className="w-fit bg-primary/10 text-primary hover:bg-primary/20 border-none px-3 py-1 text-sm font-medium">
            For Neurodiverse Learners
          </Badge>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1]">
            AI learning that adapts to how <span className="text-primary">YOUR</span> child learns.
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-2xl">
            AIVO uses 14 specialized AI tutors and Brain-Clone technology to create a learning
            environment tailored perfectly to your child's unique functioning level and sensory
            needs.
          </p>

          <div className="mt-4 flex flex-col sm:flex-row gap-4 items-start">
            <Button
              size="lg"
              className="h-16 px-8 text-lg rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl shadow-primary/20 group"
            >
              Start Free Trial
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <p className="text-sm text-muted-foreground mt-4 sm:mt-0 sm:py-5 font-medium">
              Free for the first month • Cancel anytime
            </p>
          </div>

          <div className="mt-8 rounded-3xl overflow-hidden border-2 border-border/50 shadow-2xl relative aspect-video">
            <img
              src="/__mockup/images/nd-focused-hero.png"
              alt="Neurodiverse child learning happily with a tablet"
              className="object-cover w-full h-full"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
          </div>
        </div>
      </Section>

      {/* Trust Strip */}
      <Section bg="bg-secondary/30">
        <div className="flex flex-col items-center text-center gap-12">
          <h2 className="text-2xl font-semibold text-muted-foreground uppercase tracking-widest">
            Trusted By
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="font-bold text-xl">10,000+ Parents</h3>
              <p className="text-muted-foreground text-center text-sm max-w-xs">
                Using AIVO daily to support their children's unique learning paths.
              </p>
            </div>

            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <Brain className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-bold text-xl">Special Ed Teachers</h3>
              <p className="text-muted-foreground text-center text-sm max-w-xs">
                Integrating AIVO's Brain-Clone insights into IEPs.
              </p>
            </div>

            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center">
                <Heart className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="font-bold text-xl">Pediatric Clinicians</h3>
              <p className="text-muted-foreground text-center text-sm max-w-xs">
                Recommending AIVO for its sensory-safe design principles.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* Pillar 1: Brain-Clone */}
      <Section>
        <div className="flex flex-col gap-8">
          <p className="text-sm font-bold text-primary uppercase tracking-widest">Core Pillar 1</p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            The Brain-Clone Architecture
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Every neurodiverse mind is beautiful and completely unique. AIVO doesn't use a
            "one-size-fits-all" algorithm. Instead, it builds a personalized{" "}
            <strong>Brain-Clone</strong> model that learns <em>how</em> your child learns.
          </p>

          <ul className="mt-6 space-y-6">
            <li className="flex items-start gap-4 p-6 rounded-2xl bg-secondary/50 border border-border">
              <CheckCircle2 className="w-6 h-6 text-primary shrink-0 mt-1" />
              <div>
                <h4 className="font-bold text-lg">Adapts to Frustration</h4>
                <p className="text-muted-foreground mt-1">
                  If the system detects escalating frustration, it automatically shifts tone,
                  simplifies language, or suggests a movement break.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-4 p-6 rounded-2xl bg-secondary/50 border border-border">
              <CheckCircle2 className="w-6 h-6 text-primary shrink-0 mt-1" />
              <div>
                <h4 className="font-bold text-lg">Remembers Preferences</h4>
                <p className="text-muted-foreground mt-1">
                  It learns if your child prefers visual explanations, short text, or audio
                  instructions, and applies that across all subjects.
                </p>
              </div>
            </li>
          </ul>
        </div>
      </Section>

      {/* Pillar 2: Tutors */}
      <Section bg="bg-secondary/20">
        <div className="flex flex-col gap-8">
          <p className="text-sm font-bold text-primary uppercase tracking-widest">Core Pillar 2</p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            14 Specialized AI Tutors
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed mb-6">
            Different subjects require different approaches. AIVO features a cast of 14 distinct AI
            personalities, each specialized in a subject area and trained in neuro-affirming
            communication.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="flex flex-col items-center text-center gap-3 p-4 bg-background rounded-2xl border border-border">
              <img
                src="/__mockup/images/nd-focused-tutor-1.png"
                alt="Atlas"
                className="w-20 h-20 rounded-full"
              />
              <span className="font-bold">Atlas</span>
              <span className="text-xs text-muted-foreground">Math</span>
            </div>
            <div className="flex flex-col items-center text-center gap-3 p-4 bg-background rounded-2xl border border-border">
              <img
                src="/__mockup/images/nd-focused-tutor-2.png"
                alt="Spark"
                className="w-20 h-20 rounded-full"
              />
              <span className="font-bold">Spark</span>
              <span className="text-xs text-muted-foreground">Exec. Function</span>
            </div>
            <div className="flex flex-col items-center text-center gap-3 p-4 bg-background rounded-2xl border border-border">
              <img
                src="/__mockup/images/nd-focused-tutor-3.png"
                alt="Muse"
                className="w-20 h-20 rounded-full"
              />
              <span className="font-bold">Muse</span>
              <span className="text-xs text-muted-foreground">Writing</span>
            </div>
            <div className="flex flex-col items-center text-center gap-3 p-4 bg-background rounded-2xl border border-border">
              <img
                src="/__mockup/images/nd-focused-tutor-4.png"
                alt="Nova"
                className="w-20 h-20 rounded-full"
              />
              <span className="font-bold">Nova</span>
              <span className="text-xs text-muted-foreground">Science</span>
            </div>
          </div>

          <p className="text-center text-sm font-medium text-muted-foreground mt-4">
            + 10 more specialized tutors
          </p>
        </div>
      </Section>

      {/* Pillar 3: Sensory */}
      <Section>
        <div className="flex flex-col gap-8">
          <p className="text-sm font-bold text-primary uppercase tracking-widest">Core Pillar 3</p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            Sensory & Functioning-Level Adaptation
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed">
            The UI itself changes based on your child's needs. From deep focus modes to
            low-stimulation color palettes, AIVO is designed to prevent overwhelm.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
            <div className="p-8 rounded-3xl bg-secondary/30 border border-border">
              <h3 className="text-2xl font-bold mb-2">5 Functioning Levels</h3>
              <p className="text-muted-foreground">
                Content complexity, vocabulary, and conceptual depth scale automatically to provide
                the right level of challenge without frustration.
              </p>
            </div>
            <div className="p-8 rounded-3xl bg-secondary/30 border border-border">
              <h3 className="text-2xl font-bold mb-2">Sensory Profiles</h3>
              <p className="text-muted-foreground">
                Toggle animations, adjust contrast, mute non-essential sounds, and enforce strict
                layout predictability based on sensory needs.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* How it works */}
      <Section bg="bg-secondary/10">
        <div className="flex flex-col gap-12">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-center">
            How it works
          </h2>

          <div className="space-y-8">
            <div className="flex gap-6 items-start">
              <div className="w-12 h-12 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl">
                1
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">Set up the profile</h3>
                <p className="text-lg text-muted-foreground">
                  Parents input the child's functioning level, sensory needs, and known challenges
                  (ADHD, Autism, Dyslexia, etc.).
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              <div className="w-12 h-12 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl">
                2
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">Match with a Tutor</h3>
                <p className="text-lg text-muted-foreground">
                  The child begins short, manageable sessions with specialized tutors designed for
                  neurodiverse communication.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              <div className="w-12 h-12 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl">
                3
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">Daily Brain-Clone Updates</h3>
                <p className="text-lg text-muted-foreground">
                  The AI learns every day, refining its approach to your child, while you monitor
                  progress from the Parent Dashboard.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Testimonials */}
      <Section>
        <div className="flex flex-col gap-12">
          <h2 className="text-4xl font-bold tracking-tight">Real Outcome Stories</h2>

          <div className="space-y-6">
            <div className="p-8 rounded-3xl bg-secondary/20 border border-border relative">
              <span className="absolute top-6 left-6 text-4xl text-primary/20 font-serif">"</span>
              <p className="text-lg italic leading-relaxed relative z-10 pl-6">
                My 9-year-old with ADHD usually fights math homework for an hour. With Atlas (the
                math tutor), the sessions are broken into 5-minute sprints. For the first time, he
                asked to do 'one more level'. The dashboard keeps me totally in the loop without
                hovering over his shoulder.
              </p>
              <div className="mt-6 flex items-center gap-3 pl-6">
                <div className="w-10 h-10 rounded-full bg-muted"></div>
                <div>
                  <p className="font-bold">Sarah M.</p>
                  <p className="text-sm text-muted-foreground">Parent of a 9yo with ADHD</p>
                </div>
              </div>
            </div>

            <div className="p-8 rounded-3xl bg-secondary/20 border border-border relative">
              <span className="absolute top-6 left-6 text-4xl text-primary/20 font-serif">"</span>
              <p className="text-lg italic leading-relaxed relative z-10 pl-6">
                The sensory profile settings are a game-changer. We set it to 'low stimulation' for
                my autistic daughter, which removes all the distracting UI animations and keeps the
                layout entirely predictable. The Brain-Clone figured out she needs visual aids
                before text within three days.
              </p>
              <div className="mt-6 flex items-center gap-3 pl-6">
                <div className="w-10 h-10 rounded-full bg-muted"></div>
                <div>
                  <p className="font-bold">David K.</p>
                  <p className="text-sm text-muted-foreground">
                    Parent of a 12yo on the Autism Spectrum
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Accessibility / Inclusivity Commitment */}
      <Section bg="bg-secondary/10">
        <div className="flex flex-col items-center text-center gap-8 border-2 border-primary/20 bg-background p-12 rounded-[2.5rem]">
          <Shield className="w-12 h-12 text-primary" />
          <h2 className="text-3xl font-bold">Our Commitment to Accessibility</h2>
          <p className="text-lg text-muted-foreground max-w-xl">
            AIVO is built from the ground up to exceed WCAG AA standards. We support OpenDyslexic
            fonts, screen readers, keyboard navigation, and custom high-contrast modes. Learning
            belongs to everyone.
          </p>
        </div>
      </Section>

      {/* Final CTA */}
      <Section>
        <div className="flex flex-col items-center text-center gap-8 py-12">
          <h2 className="text-5xl font-bold tracking-tight">Ready to support their unique mind?</h2>

          <div className="p-8 rounded-3xl bg-secondary/30 border border-border w-full max-w-md mx-auto">
            <h3 className="text-2xl font-bold">AIVO Premium</h3>
            <div className="my-4 flex items-baseline justify-center gap-1">
              <span className="text-5xl font-bold">$29</span>
              <span className="text-muted-foreground font-medium">/month</span>
            </div>
            <p className="text-muted-foreground mb-8">
              Access to all 14 tutors, full Brain-Clone personalization, and the Parent Dashboard.
            </p>

            <Button
              size="lg"
              className="w-full h-14 text-lg rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Start Your Free Month
            </Button>
            <p className="text-xs text-muted-foreground mt-4">Cancel anytime. No commitment.</p>
          </div>
        </div>
      </Section>

      {/* Footer */}
      <footer className="py-12 text-center border-t border-border/50 text-muted-foreground text-sm flex flex-col gap-4">
        <div className="font-bold text-foreground text-xl">AIVO</div>
        <div className="flex justify-center gap-6">
          <a href="#" className="hover:text-foreground transition-colors">
            Privacy Policy
          </a>
          <a href="#" className="hover:text-foreground transition-colors">
            Terms of Service
          </a>
          <a href="#" className="hover:text-foreground transition-colors">
            Contact Support
          </a>
        </div>
        <p className="mt-4">© 2024 AIVO Learning. Designed for every mind.</p>
      </footer>
    </div>
  );
}
