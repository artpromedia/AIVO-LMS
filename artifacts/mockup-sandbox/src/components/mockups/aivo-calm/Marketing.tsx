import React from "react";
import "./_group.css";
import { Button } from "@/components/ui/button";
import {
  Heart,
  Brain,
  GraduationCap,
  ArrowRight,
  Star,
  Settings,
  ShieldCheck,
  Quote,
  Check,
} from "lucide-react";

export function Marketing() {
  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] font-['DM_Sans']">
      {/* Quiet Header */}
      <header className="sticky top-0 z-50 bg-[hsl(var(--background))/0.9] backdrop-blur-md border-b border-[hsl(var(--border))]">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[hsl(var(--primary))] flex items-center justify-center">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-medium tracking-tight">AIVO</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-[hsl(var(--muted-foreground))] font-medium">
            <a href="#how" className="hover:text-[hsl(var(--foreground))] transition-colors">
              How it works
            </a>
            <a href="#tutors" className="hover:text-[hsl(var(--foreground))] transition-colors">
              Tutors
            </a>
            <a href="#levels" className="hover:text-[hsl(var(--foreground))] transition-colors">
              Adaptability
            </a>
            <a href="#pricing" className="hover:text-[hsl(var(--foreground))] transition-colors">
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-4">
            <a
              href="/login"
              className="hidden sm:inline-flex font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              Sign in
            </a>
            <Button className="rounded-full bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.9)] text-[hsl(var(--primary-foreground))] px-6 h-11 text-base shadow-sm">
              Start Learning
            </Button>
          </div>
        </div>
      </header>

      {/* Empathy-led Hero */}
      <section className="relative px-6 pt-24 pb-32 max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-16">
        <div className="flex-1 space-y-8 text-center lg:text-left z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] text-sm font-medium mb-4">
            <Star className="w-4 h-4 text-[hsl(var(--accent))]" />
            <span>Designed for neurodiverse minds</span>
          </div>
          <h1 className="text-5xl lg:text-7xl font-medium leading-[1.1] tracking-tight text-[hsl(var(--foreground))]">
            Built for the ways your child's mind works.
          </h1>
          <p className="text-xl text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto lg:mx-0 leading-relaxed">
            A quiet, adaptable learning platform that reduces sensory load and adjusts to your
            child's unique cognitive profile. Every day is a calm step forward.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-4">
            <Button className="rounded-full bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.9)] text-[hsl(var(--primary-foreground))] px-8 h-14 text-lg shadow-sm">
              Start Free Trial
            </Button>
            <Button
              variant="outline"
              className="rounded-full border-[hsl(var(--border))] bg-transparent hover:bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))] px-8 h-14 text-lg"
            >
              Explore the platform
            </Button>
          </div>
        </div>

        <div className="flex-1 w-full max-w-lg lg:max-w-none relative">
          <div className="absolute inset-0 bg-[hsl(var(--primary)/0.1)] rounded-full blur-3xl transform -translate-y-12"></div>
          <div className="relative rounded-3xl overflow-hidden border-8 border-white shadow-xl bg-white aspect-[4/3] flex items-center justify-center p-4">
            <img
              src="/__mockup/images/aivo-calm/hero.png"
              alt="Soft watercolor illustration of a parent and child learning together calmly"
              className="w-full h-full object-cover rounded-2xl"
            />
          </div>
        </div>
      </section>

      {/* Entry Points / Who is this for */}
      <section className="px-6 py-20 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl font-medium">A calm space for everyone involved</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: "For Parents",
                desc: "Gain deep insights into how your child learns best, not just what they scored. Manage sensory settings and sync with IEPs.",
                icon: Heart,
                action: "Parent Guide",
              },
              {
                title: "For Learners",
                desc: "A safe, predictable digital environment with gentle tutors, zero timers, and kid-friendly gamification that honors their pace.",
                icon: Brain,
                action: "Meet the Tutors",
              },
              {
                title: "For Educators",
                desc: "Seamlessly integrate with 504 plans and classroom objectives. Monitor progress without adding assessment anxiety.",
                icon: GraduationCap,
                action: "Educator Tools",
              },
            ].map((role, idx) => (
              <div
                key={idx}
                className="bg-[hsl(var(--background))] rounded-3xl p-8 space-y-6 flex flex-col h-full border border-[hsl(var(--border))]"
              >
                <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--primary)/0.2)] flex items-center justify-center">
                  <role.icon className="w-7 h-7 text-[hsl(var(--primary))]" />
                </div>
                <h3 className="text-2xl font-medium">{role.title}</h3>
                <p className="text-[hsl(var(--muted-foreground))] flex-1 text-lg">{role.desc}</p>
                <div className="pt-4">
                  <a
                    href="#"
                    className="inline-flex items-center gap-2 text-[hsl(var(--primary))] font-medium group hover:text-[hsl(var(--primary)/0.8)] transition-colors"
                  >
                    {role.action}{" "}
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quiet Features (BrainClone) */}
      <section className="px-6 py-32 bg-[hsl(var(--background))] relative overflow-hidden">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-20">
          <div className="flex-1 w-full max-w-md">
            <div className="aspect-square rounded-[3rem] bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] overflow-hidden p-8 flex items-center justify-center relative">
              <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary)/0.1)] to-transparent"></div>
              <img
                src="/__mockup/images/aivo-calm/brainclone.png"
                alt="Brain clone companion illustration"
                className="relative z-10 w-full max-w-[280px] object-contain opacity-90 mix-blend-multiply"
              />
            </div>
          </div>
          <div className="flex-1 space-y-8">
            <h2 className="text-4xl font-medium leading-tight">The BrainClone Companion</h2>
            <p className="text-xl text-[hsl(var(--muted-foreground))] leading-relaxed">
              It's a kind digital companion that learns alongside your child. Over time, it maps
              their unique cognitive pathways—recognizing when they need a visual explanation, when
              they need a break, and what encourages them without overwhelming them.
            </p>
            <ul className="space-y-4 pt-4">
              {[
                "Adapts to processing speed dynamically",
                "Remembers preferred explanation styles",
                "Never judges or rushes a response",
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-4 text-lg">
                  <div className="w-6 h-6 rounded-full bg-[hsl(var(--primary)/0.2)] flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 text-[hsl(var(--primary))]" />
                  </div>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Functioning Levels as a Journey */}
      <section id="levels" className="px-6 py-32 bg-white">
        <div className="max-w-6xl mx-auto space-y-20">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            <h2 className="text-4xl font-medium">A continuous journey, not a hierarchy</h2>
            <p className="text-xl text-[hsl(var(--muted-foreground))]">
              We respect 5 functioning levels that seamlessly adjust interface complexity, language,
              and pacing. It’s a gentle curve, avoiding sensitive terms like "high" or "low"
              functioning.
            </p>
          </div>

          <div className="relative pt-12 pb-24">
            {/* The curved path (simplified as a soft line) */}
            <div className="hidden md:block absolute top-1/2 left-0 w-full h-2 bg-[hsl(var(--secondary))] rounded-full -translate-y-1/2 z-0"></div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 relative z-10">
              {[
                {
                  level: "1",
                  name: "Emerging",
                  desc: "Highly visual, minimal text, simplified choices.",
                },
                {
                  level: "2",
                  name: "Exploring",
                  desc: "Gentle text introduction, structured repetition.",
                },
                {
                  level: "3",
                  name: "Developing",
                  desc: "Balanced visual and text, guided prompts.",
                },
                { level: "4", name: "Expanding", desc: "More reading, nuanced problem solving." },
                { level: "5", name: "Fluent", desc: "Standard text density, independent pacing." },
              ].map((lvl, idx) => (
                <div
                  key={idx}
                  className="bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-3xl p-6 text-center space-y-4 relative md:-translate-y-8 hover:-translate-y-10 transition-transform duration-500 ease-out shadow-sm hover:shadow-md"
                >
                  <div className="w-12 h-12 mx-auto bg-white rounded-full flex items-center justify-center text-xl font-medium text-[hsl(var(--primary))] border border-[hsl(var(--border))] shadow-sm">
                    {lvl.level}
                  </div>
                  <h4 className="text-lg font-medium">{lvl.name}</h4>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">{lvl.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Parent Testimonials (I-voice) */}
      <section className="px-6 py-32 bg-[hsl(var(--primary)/0.1)] border-y border-[hsl(var(--border))]">
        <div className="max-w-6xl mx-auto space-y-16">
          <h2 className="text-3xl font-medium text-center">Stories from real families</h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-3xl p-10 space-y-6 shadow-sm border border-white">
              <Quote className="w-8 h-8 text-[hsl(var(--accent)/0.5)]" />
              <p className="text-xl leading-relaxed text-[hsl(var(--foreground))]">
                "I used to sit next to Aisha, constantly translating what the screen wanted her to
                do. AIVO is the first platform where I can step back. It actually waits for her to
                process, without a countdown timer making her anxious."
              </p>
              <div className="flex items-center gap-4 pt-4 border-t border-[hsl(var(--border))]">
                <div className="w-12 h-12 rounded-full bg-[hsl(var(--secondary))] flex items-center justify-center font-medium text-[hsl(var(--muted-foreground))]">
                  L
                </div>
                <div>
                  <div className="font-medium">Liam R.</div>
                  <div className="text-sm text-[hsl(var(--muted-foreground))]">
                    Parent of Aisha (8, ADHD)
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-10 space-y-6 shadow-sm border border-white">
              <Quote className="w-8 h-8 text-[hsl(var(--accent)/0.5)]" />
              <p className="text-xl leading-relaxed text-[hsl(var(--foreground))]">
                "Finding tools for a Level 2 learner that don't feel 'babyish' is so hard. The
                tutors on AIVO treat my son with respect. The progress streaks are gentle—if he
                misses a day because he's overwhelmed, he doesn't lose his badges."
              </p>
              <div className="flex items-center gap-4 pt-4 border-t border-[hsl(var(--border))]">
                <div className="w-12 h-12 rounded-full bg-[hsl(var(--secondary))] flex items-center justify-center font-medium text-[hsl(var(--muted-foreground))]">
                  M
                </div>
                <div>
                  <div className="font-medium">Maria S.</div>
                  <div className="text-sm text-[hsl(var(--muted-foreground))]">
                    Parent of Leo (11, Autism)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Compliance Strip */}
      <section className="px-6 py-16 bg-white border-b border-[hsl(var(--border))]">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="flex justify-center items-center gap-3 text-[hsl(var(--primary))]">
            <ShieldCheck className="w-8 h-8" />
            <h2 className="text-2xl font-medium">Your family's privacy is sacred</h2>
          </div>
          <p className="text-lg text-[hsl(var(--muted-foreground))]">
            We are fully COPPA and FERPA compliant. Data is never sold, advertising is completely
            absent, and you control what information is shared with educators.
          </p>
          <div className="flex flex-wrap justify-center gap-8 text-[hsl(var(--muted-foreground))] font-medium pt-4">
            <span className="flex items-center gap-2">
              <Check className="w-5 h-5 text-[hsl(var(--primary))]" /> No ads ever
            </span>
            <span className="flex items-center gap-2">
              <Check className="w-5 h-5 text-[hsl(var(--primary))]" /> Data encrypted
            </span>
            <span className="flex items-center gap-2">
              <Check className="w-5 h-5 text-[hsl(var(--primary))]" /> Parent-controlled
            </span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-16 bg-[hsl(var(--background))]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[hsl(var(--primary))] flex items-center justify-center">
              <Heart className="w-3 h-3 text-white" />
            </div>
            <span className="text-xl font-medium">AIVO Learning</span>
          </div>
          <div className="flex flex-wrap justify-center gap-8 text-sm font-medium text-[hsl(var(--muted-foreground))]">
            <a href="#" className="hover:text-[hsl(var(--foreground))]">
              About
            </a>
            <a href="#" className="hover:text-[hsl(var(--foreground))]">
              Research
            </a>
            <a href="#" className="hover:text-[hsl(var(--foreground))]">
              Privacy
            </a>
            <a href="#" className="hover:text-[hsl(var(--foreground))]">
              Terms
            </a>
          </div>
          <div className="text-sm text-[hsl(var(--muted-foreground))]">
            © {new Date().getFullYear()} AIVO. Built with care.
          </div>
        </div>
      </footer>
    </div>
  );
}
