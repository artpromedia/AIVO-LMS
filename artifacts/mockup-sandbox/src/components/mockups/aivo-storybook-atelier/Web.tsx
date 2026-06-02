import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  BookOpen,
  Star,
  ArrowRight,
  ShieldCheck,
  Heart,
  Sparkles,
  Brain,
  Check,
} from "lucide-react";
import "./_group.css";

export function Web() {
  return (
    <div className="storybook-theme relative min-h-screen min-w-[1280px] bg-background text-foreground overflow-hidden font-sans">
      <div className="paper-texture"></div>

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-12 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <BookOpen className="w-8 h-8 text-primary" strokeWidth={1.5} />
          <span className="font-display text-2xl font-bold tracking-tight text-foreground">
            AIVO
          </span>
        </div>
        <div className="flex items-center gap-8 font-medium">
          <a href="#" className="text-foreground/80 hover:text-primary transition-colors">
            For Parents
          </a>
          <a href="#" className="text-foreground/80 hover:text-primary transition-colors">
            For Schools
          </a>
          <a href="#" className="text-foreground/80 hover:text-primary transition-colors">
            How it Works
          </a>
          <a href="#" className="text-foreground/80 hover:text-primary transition-colors">
            Pricing
          </a>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" className="font-semibold">
            Log In
          </Button>
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-full px-6 organic-border">
            Start Learning
          </Button>
        </div>
      </nav>

      <main className="relative z-10">
        {/* Hero Section */}
        <section className="px-12 pt-16 pb-24 max-w-7xl mx-auto flex items-center gap-16">
          <div className="flex-1 space-y-8">
            <Badge
              variant="outline"
              className="text-primary border-primary/20 bg-primary/5 px-4 py-1 text-sm font-medium rounded-full"
            >
              <Star className="w-4 h-4 mr-2 inline" />
              Trusted by 10,000+ parents and schools
            </Badge>
            <h1 className="font-display text-6xl leading-[1.1] text-foreground">
              Learning that <br />
              <span className="text-primary italic">adapts</span> to them.
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-xl">
              AIVO is the premium, AI-powered learning platform designed specifically for
              neurodiverse children. Because every mind tells a different story.
            </p>
            <div className="flex items-center gap-4 pt-4">
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-full px-8 text-lg organic-border h-14"
              >
                Begin their journey
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-border text-foreground font-semibold rounded-full px-8 text-lg organic-border h-14"
              >
                <Play className="w-5 h-5 mr-2" fill="currentColor" /> Watch the film
              </Button>
            </div>
            <div className="flex items-center gap-6 text-sm font-medium text-muted-foreground pt-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-accent" /> COPPA Compliant
              </div>
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-accent" /> Expert-approved
              </div>
            </div>
          </div>
          <div className="flex-1 relative">
            <div className="absolute inset-0 bg-secondary/20 organic-border transform rotate-3 scale-105 transition-transform duration-700 ease-out"></div>
            <img
              src="/__mockup/images/storybook-hero.png"
              alt="Child reading with a gentle owl companion"
              className="relative z-10 w-full object-cover organic-border shadow-2xl shadow-primary/10"
            />
          </div>
        </section>

        {/* Storybook Characters Section */}
        <section className="bg-[#f2eee3] py-24 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-12 bg-gradient-to-b from-background to-transparent"></div>
          <div className="max-w-7xl mx-auto px-12 text-center">
            <h2 className="font-display text-4xl mb-6">Meet the Tutors</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-16">
              Fourteen specialized AI companions, each with their own personality, teaching style,
              and expertise. They learn how your child learns, adapting in real-time.
            </p>

            <div className="relative max-w-4xl mx-auto">
              <img
                src="/__mockup/images/storybook-tutors.png"
                alt="AIVO's cast of friendly animal and magical tutors"
                className="w-full object-cover organic-border shadow-xl shadow-foreground/5 bg-white/50"
              />
            </div>
          </div>
        </section>

        {/* Features / Magic */}
        <section className="py-24 max-w-7xl mx-auto px-12">
          <div className="grid grid-cols-3 gap-12">
            <div className="space-y-4">
              <div className="w-12 h-12 bg-secondary/20 rounded-full flex items-center justify-center text-secondary mb-6 organic-border">
                <Brain className="w-6 h-6" />
              </div>
              <h3 className="font-display text-2xl">The Brain-Clone</h3>
              <p className="text-muted-foreground leading-relaxed">
                Our core technology builds a unique model of your child's learning patterns. It
                knows when they need a gentle push, and when they need a visual break.
              </p>
            </div>
            <div className="space-y-4">
              <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center text-primary mb-6 organic-border">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="font-display text-2xl">Five Functioning Levels</h3>
              <p className="text-muted-foreground leading-relaxed">
                From standard curriculum down to pre-symbolic communication. AIVO seamlessly
                translates concepts into the exact modality your child grasps best.
              </p>
            </div>
            <div className="space-y-4">
              <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center text-accent mb-6 organic-border">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="font-display text-2xl">Sensory-Aware Design</h3>
              <p className="text-muted-foreground leading-relaxed">
                No loud buzzers. No flashing lights. No chaotic menus. Every interaction is designed
                to be calming, predictable, and supportive.
              </p>
            </div>
          </div>
        </section>

        {/* Testimonial */}
        <section className="py-24 bg-[#eae4d5] relative">
          <div className="max-w-4xl mx-auto px-12 text-center">
            <Star className="w-10 h-10 text-secondary mx-auto mb-8" fill="currentColor" />
            <blockquote className="font-display text-3xl leading-relaxed text-foreground mb-8">
              "It feels less like software and more like a patient, infinitely knowledgeable friend
              reading a book with my son. It's the first time he's asked to do his learning time."
            </blockquote>
            <cite className="block text-lg font-medium text-foreground">
              Sarah J.
              <span className="block text-sm text-muted-foreground font-normal mt-1">
                Parent of a 7-year-old with autism
              </span>
            </cite>
          </div>
        </section>

        {/* CTA */}
        <section className="py-32 max-w-5xl mx-auto px-12 text-center">
          <h2 className="font-display text-5xl mb-6">Write their next chapter.</h2>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Join the families and educators who have discovered a more thoughtful way to learn. Try
            AIVO free for 14 days.
          </p>
          <Button
            size="lg"
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-full px-12 text-lg organic-border h-16 shadow-lg shadow-primary/20"
          >
            Start your free trial <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </section>
      </main>

      <footer className="border-t border-border/50 py-12 px-12 text-center text-muted-foreground text-sm relative z-10">
        <p>&copy; {new Date().getFullYear()} AIVO Learning. Crafted with care.</p>
      </footer>
    </div>
  );
}
