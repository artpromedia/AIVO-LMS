import React from "react";
import {
  Heart,
  Star,
  Zap,
  Shield,
  Brain,
  Sparkles,
  CheckCircle2,
  Users,
  Puzzle,
  ArrowRight,
  PlayCircle,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import "./_group.css";

// ----------------------------------------------------------------------
// DATA
// ----------------------------------------------------------------------

const pillars = [
  {
    title: "14 Friendly AI Tutors",
    description:
      "Colorful, specialized companions that make learning feel like play. Each tutor focuses on a specific subject and adapts to your child's pace.",
    icon: Users,
    color: "bg-[hsl(var(--visual-math))] text-white",
    lightBg: "bg-[hsl(var(--visual-math))]/10",
    image: "/__mockup/images/nd-visual-feature-2.png",
  },
  {
    title: "Brain-Clone Personalization",
    description:
      "A secure, private AI model that learns how your child thinks. It remembers their preferences, strengths, and areas for growth daily.",
    icon: Brain,
    color: "bg-[hsl(var(--visual-primary))] text-white",
    lightBg: "bg-[hsl(var(--visual-primary-light))]",
    image: "/__mockup/images/nd-visual-feature-1.png",
  },
  {
    title: "Sensory & Level Adaptation",
    description:
      "Adjust colors, sounds, and complexity instantly. Perfect for sensory-sensitive days or when extra focus is needed.",
    icon: Sparkles,
    color: "bg-[hsl(var(--visual-reading))] text-white",
    lightBg: "bg-[hsl(var(--visual-reading))]/10",
    image: "/__mockup/images/nd-visual-feature-3.png",
  },
];

const testimonials = [
  {
    quote:
      "For the first time, my non-verbal son is asking to do his 'number games'. The visual feedback makes perfect sense to him.",
    author: "Sarah M.",
    role: "Parent of 7yo",
    color: "text-[hsl(var(--visual-math))]",
  },
  {
    quote:
      "The ability to lower the visual clutter on high-sensory days has been a game changer. We don't have meltdowns during homework anymore.",
    author: "David L.",
    role: "Parent of 9yo",
    color: "text-[hsl(var(--visual-primary))]",
  },
];

const steps = [
  {
    number: "1",
    title: "Create Profile",
    desc: "Set sensory preferences & levels",
    icon: Heart,
    color: "text-[hsl(var(--visual-math))]",
  },
  {
    number: "2",
    title: "Meet Tutors",
    desc: "Child picks their favorite companions",
    icon: Star,
    color: "text-[hsl(var(--visual-reading))]",
  },
  {
    number: "3",
    title: "Grow Together",
    desc: "Brain-Clone adapts every session",
    icon: Zap,
    color: "text-[hsl(var(--visual-sel))]",
  },
];

// ----------------------------------------------------------------------
// COMPONENTS
// ----------------------------------------------------------------------

export function Landing() {
  return (
    <div className="nd-visual min-h-screen flex flex-col bg-[hsl(var(--visual-bg))] overflow-x-hidden">
      {/* Navigation */}
      <nav className="p-6 flex items-center justify-between max-w-7xl mx-auto w-full relative z-20">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-[hsl(var(--visual-primary))] rounded-2xl flex items-center justify-center text-white font-bold text-2xl transform -rotate-3 shadow-lg shadow-[hsl(var(--visual-primary))]/20">
            A
          </div>
          <span className="text-2xl font-black tracking-tight text-gray-800 font-['Quicksand']">
            AIVO
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            className="hidden md:flex font-bold text-gray-600 hover:text-[hsl(var(--visual-primary))] rounded-full"
          >
            For Parents
          </Button>
          <Button
            variant="ghost"
            className="hidden md:flex font-bold text-gray-600 hover:text-[hsl(var(--visual-primary))] rounded-full"
          >
            How it Works
          </Button>
          <Button className="nd-visual-button bg-[hsl(var(--visual-primary))] hover:bg-[hsl(var(--visual-primary))]/90 text-white px-8 h-12 shadow-md">
            Start Free
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-10 pb-20 md:pt-20 md:pb-32 px-6 overflow-hidden">
        {/* Decorative Blobs */}
        <div className="absolute top-20 -left-20 w-64 h-64 bg-[hsl(var(--visual-math))]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-40 -right-20 w-80 h-80 bg-[hsl(var(--visual-reading))]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center relative z-10">
          <div className="flex flex-col gap-6 text-center md:text-left">
            <Badge className="w-fit mx-auto md:mx-0 bg-white text-[hsl(var(--visual-primary))] border-2 border-[hsl(var(--visual-primary-light))] px-4 py-1.5 text-sm font-bold uppercase tracking-wider">
              <Star size={14} fill="currentColor" className="mr-2" /> Designed for Neurodiversity
            </Badge>
            <h1 className="text-5xl md:text-7xl font-black text-gray-900 leading-[1.1]">
              AI learning that <span className="text-[hsl(var(--visual-primary))]">adapts</span> to
              how YOUR child learns.
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 font-semibold leading-relaxed max-w-lg mx-auto md:mx-0">
              A sensory-friendly platform where specialized AI tutors adjust to your child's unique
              functioning level, mood, and pace.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 mt-4 justify-center md:justify-start">
              <Button className="nd-visual-button bg-[hsl(var(--visual-primary))] hover:bg-[hsl(var(--visual-primary))]/90 text-white h-16 px-10 text-xl w-full sm:w-auto shadow-xl shadow-[hsl(var(--visual-primary))]/30 transition-transform hover:-translate-y-1">
                Start Free Trial
              </Button>
              <Button
                variant="outline"
                className="nd-visual-button bg-white border-2 border-gray-200 text-gray-700 h-16 px-8 text-lg w-full sm:w-auto hover:bg-gray-50"
              >
                <PlayCircle size={20} className="mr-2" /> See it in action
              </Button>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-lg">
            <div className="absolute inset-0 bg-gradient-to-tr from-[hsl(var(--visual-primary-light))] to-[hsl(var(--visual-math))]/20 rounded-[3rem] transform rotate-3 scale-105" />
            <img
              src="/__mockup/images/nd-visual-hero.png"
              alt="Inclusive children using tablets"
              className="relative z-10 w-full h-auto object-cover rounded-[3rem] shadow-2xl border-4 border-white"
            />
            {/* Floating Badges */}
            <div
              className="absolute -left-6 top-20 z-20 bg-white p-3 rounded-2xl shadow-xl flex items-center gap-3 border-2 border-[hsl(var(--visual-math))]/10 motion-safe:animate-bounce"
              style={{ animationDuration: "3s" }}
            >
              <div className="w-10 h-10 bg-[hsl(var(--visual-math))]/10 text-[hsl(var(--visual-math))] rounded-xl flex items-center justify-center">
                <Heart size={20} fill="currentColor" />
              </div>
              <span className="font-bold text-sm text-gray-800 pr-2">Calm Mode On</span>
            </div>
            <div
              className="absolute -right-6 bottom-20 z-20 bg-white p-3 rounded-2xl shadow-xl flex items-center gap-3 border-2 border-[hsl(var(--visual-reading))]/10 motion-safe:animate-bounce"
              style={{ animationDuration: "4s" }}
            >
              <div className="w-10 h-10 bg-[hsl(var(--visual-reading))]/10 text-[hsl(var(--visual-reading))] rounded-xl flex items-center justify-center">
                <Star size={20} fill="currentColor" />
              </div>
              <span className="font-bold text-sm text-gray-800 pr-2">Level Up!</span>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Strip */}
      <section className="bg-white py-10 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-center gap-8 text-center sm:text-left">
          <p className="font-bold text-gray-400 uppercase tracking-widest text-sm">
            Trusted and loved by
          </p>
          <div className="flex flex-wrap justify-center gap-8 text-gray-600 font-bold text-lg items-center">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="text-[hsl(var(--visual-science))]" size={20} /> Parents
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="text-[hsl(var(--visual-science))]" size={20} /> Educators
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="text-[hsl(var(--visual-science))]" size={20} /> Clinicians
            </span>
          </div>
        </div>
      </section>

      {/* Core Pillars */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
            Built for their world.
          </h2>
          <p className="text-xl text-gray-600 font-medium">
            Three ways AIVO creates a safe, engaging, and personalized learning environment.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {pillars.map((pillar, i) => (
            <Card key={i} className="nd-visual-card overflow-hidden group border-none">
              <div
                className={`${pillar.lightBg} h-48 p-6 flex items-center justify-center relative overflow-hidden`}
              >
                <div
                  className={`absolute top-4 left-4 w-12 h-12 rounded-2xl ${pillar.color} flex items-center justify-center shadow-lg z-10`}
                >
                  <pillar.icon size={24} strokeWidth={2.5} />
                </div>
                <img
                  src={pillar.image}
                  alt={pillar.title}
                  className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <CardContent className="p-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-3">{pillar.title}</h3>
                <p className="text-gray-600 font-medium leading-relaxed">{pillar.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How it Works (3 Steps) */}
      <section className="py-24 px-6 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto relative z-10">
          <h2 className="text-4xl font-black text-center text-gray-900 mb-16">How AIVO works</h2>

          <div className="flex flex-col md:flex-row justify-center gap-8 md:gap-4 relative">
            {/* Connecting Line (Desktop) */}
            <div className="hidden md:block absolute top-12 left-1/6 right-1/6 h-2 bg-gray-100 rounded-full z-0" />

            {steps.map((step, i) => (
              <div key={i} className="flex-1 flex flex-col items-center text-center relative z-10">
                <div
                  className={`w-24 h-24 bg-white rounded-full border-4 border-white shadow-xl flex items-center justify-center mb-6 relative`}
                >
                  <step.icon size={40} className={step.color} strokeWidth={2.5} />
                  <div
                    className={`absolute -top-3 -right-3 w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center font-black text-sm border-2 border-white`}
                  >
                    {step.number}
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-600 font-medium max-w-xs">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {testimonials.map((test, i) => (
            <Card
              key={i}
              className="nd-visual-card border-none bg-gradient-to-br from-white to-gray-50 p-8 md:p-10 relative"
            >
              <div className="absolute top-8 right-8 opacity-10">
                <Heart size={80} className={test.color} fill="currentColor" />
              </div>
              <CardContent className="p-0 relative z-10 flex flex-col h-full justify-between">
                <p className="text-xl md:text-2xl font-bold text-gray-800 leading-snug mb-8">
                  "{test.quote}"
                </p>
                <div className="flex items-center gap-4 mt-auto">
                  <div
                    className={`w-12 h-12 rounded-full ${test.color.replace("text-", "bg-")}/20 flex items-center justify-center font-bold ${test.color} text-lg`}
                  >
                    {test.author[0]}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">{test.author}</h4>
                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                      {test.role}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Inclusivity Commitment */}
      <section className="py-16 px-6 bg-[hsl(var(--visual-primary))] text-white text-center">
        <div className="max-w-3xl mx-auto flex flex-col items-center">
          <Shield size={48} className="mb-6 opacity-90" />
          <h2 className="text-3xl font-black mb-4">Our Commitment to Inclusivity</h2>
          <p className="text-lg font-medium opacity-90 leading-relaxed">
            AIVO is built with strict WCAG AA standards, respects COPPA/FERPA privacy, and is
            designed alongside neurodivergent individuals and clinicians. We do not use "lorem
            ipsum" in our care—every pixel matters.
          </p>
        </div>
      </section>

      {/* Pricing Teaser & Final CTA */}
      <section className="py-24 px-6 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100 font-bold text-gray-700 mb-8">
          <Lock size={16} className="text-[hsl(var(--visual-science))]" /> One simple tier. Cancel
          anytime.
        </div>
        <h2 className="text-5xl font-black text-gray-900 mb-6">Ready to meet their new tutors?</h2>
        <p className="text-2xl text-gray-600 font-medium mb-10">
          Try AIVO{" "}
          <strong className="text-[hsl(var(--visual-primary))]">Free for the first month</strong>.
          Then just $19/mo.
        </p>
        <Button className="nd-visual-button bg-[hsl(var(--visual-primary))] hover:bg-[hsl(var(--visual-primary))]/90 text-white h-16 px-12 text-xl shadow-xl shadow-[hsl(var(--visual-primary))]/30 hover:scale-105 transition-transform w-full sm:w-auto">
          Start Your Free Month <ArrowRight className="ml-2" />
        </Button>
        <p className="mt-6 text-sm font-bold text-gray-400 uppercase tracking-wider">
          No credit card required for trial
        </p>
      </section>

      {/* Footer */}
      <footer className="bg-white py-12 px-6 border-t border-gray-100 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-50 grayscale">
            <div className="w-8 h-8 bg-gray-900 rounded-xl flex items-center justify-center text-white font-bold text-lg transform -rotate-3">
              A
            </div>
            <span className="text-xl font-black tracking-tight text-gray-900 font-['Quicksand']">
              AIVO
            </span>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-sm font-bold text-gray-500">
            <a href="#" className="hover:text-[hsl(var(--visual-primary))]">
              Privacy
            </a>
            <a href="#" className="hover:text-[hsl(var(--visual-primary))]">
              Terms
            </a>
            <a href="#" className="hover:text-[hsl(var(--visual-primary))]">
              Accessibility
            </a>
            <a href="#" className="hover:text-[hsl(var(--visual-primary))]">
              Contact Support
            </a>
          </div>
          <p className="text-sm font-bold text-gray-400">© 2025 AIVO Learning</p>
        </div>
      </footer>
    </div>
  );
}
