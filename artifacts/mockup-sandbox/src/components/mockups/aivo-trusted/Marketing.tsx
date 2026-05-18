import React, { useState } from "react";
import "./_group.css";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Brain,
  Calculator,
  CheckCircle,
  ChevronRight,
  GraduationCap,
  Heart,
  LineChart,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  Users,
} from "lucide-react";

export function Marketing() {
  return (
    <div className="trusted-theme min-h-screen selection:bg-[hsl(var(--ring)/0.3)]">
      {/* Navigation */}
      <nav className="border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/95 backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--background))]/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[hsl(var(--foreground))]">
            <div className="w-8 h-8 rounded bg-[hsl(var(--primary))] text-white flex items-center justify-center font-bold font-serif text-xl tracking-tighter">
              A
            </div>
            <span className="font-bold text-xl tracking-tight">AIVO</span>
          </div>
          <div className="hidden md:flex gap-8 text-sm font-medium">
            <a
              href="#subjects"
              className="text-[hsl(var(--foreground))] hover:text-[hsl(var(--ring))] transition-colors"
            >
              Subjects
            </a>
            <a
              href="#how-it-works"
              className="text-[hsl(var(--foreground))] hover:text-[hsl(var(--ring))] transition-colors"
            >
              How it works
            </a>
            <a
              href="#districts"
              className="text-[hsl(var(--foreground))] hover:text-[hsl(var(--ring))] transition-colors"
            >
              For Districts
            </a>
            <a
              href="#pricing"
              className="text-[hsl(var(--foreground))] hover:text-[hsl(var(--ring))] transition-colors"
            >
              Pricing
            </a>
          </div>
          <div className="flex gap-4">
            <Button
              variant="ghost"
              className="hidden sm:flex font-semibold hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--primary))]"
            >
              Log in
            </Button>
            <Button className="bg-[hsl(var(--ring))] hover:bg-[hsl(var(--ring-hover))] text-white font-bold rounded-full px-6 shadow-sm">
              Sign up
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-20 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-[hsl(var(--primary))] tracking-tight max-w-4xl mx-auto leading-tight">
          Catch up. Get ahead. <br className="hidden sm:block" />
          <span className="text-[hsl(var(--ring))] relative inline-block">
            On their terms.
            <svg
              className="absolute w-full h-3 -bottom-1 left-0 text-[hsl(var(--ring))/0.3]"
              viewBox="0 0 100 10"
              preserveAspectRatio="none"
            >
              <path
                d="M0 5 Q 50 10 100 5"
                stroke="currentColor"
                strokeWidth="4"
                fill="transparent"
              />
            </svg>
          </span>
        </h1>
        <p className="mt-6 text-xl text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto leading-relaxed">
          The evidence-based AI learning platform for neurodiverse minds. Built for IEPs, loved by
          kids, trusted by thousands of classrooms.
        </p>

        {/* 3 Entry Points */}
        <div className="mt-16 grid md:grid-cols-3 gap-6 max-w-4xl mx-auto text-left">
          <div className="bg-white border border-[hsl(var(--border))] rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group cursor-pointer">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Users size={64} />
            </div>
            <h3 className="text-xl font-bold text-[hsl(var(--primary))] mb-2 relative z-10">
              I'm a parent
            </h3>
            <p className="text-[hsl(var(--muted-foreground))] mb-4 relative z-10">
              Support their learning journey at home with tailored insights.
            </p>
            <span className="text-[hsl(var(--ring))] font-bold flex items-center gap-1 relative z-10 group-hover:underline">
              Start free <ChevronRight size={16} />
            </span>
          </div>

          <div className="bg-white border border-[hsl(var(--border))] rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group cursor-pointer">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <GraduationCap size={64} />
            </div>
            <h3 className="text-xl font-bold text-[hsl(var(--primary))] mb-2 relative z-10">
              I'm an educator
            </h3>
            <p className="text-[hsl(var(--muted-foreground))] mb-4 relative z-10">
              Tools to support IEPs and differentiate instruction effortlessly.
            </p>
            <span className="text-[hsl(var(--ring))] font-bold flex items-center gap-1 relative z-10 group-hover:underline">
              View district plans <ChevronRight size={16} />
            </span>
          </div>

          <div className="bg-[hsl(var(--accent))] border border-[hsl(var(--border))] rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group cursor-pointer">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Star size={64} />
            </div>
            <h3 className="text-xl font-bold text-[hsl(var(--primary))] mb-2 relative z-10">
              I'm a learner
            </h3>
            <p className="text-[hsl(var(--muted-foreground))] mb-4 relative z-10">
              Jump into your personalized world and meet your tutors.
            </p>
            <span className="text-[hsl(var(--ring))] font-bold flex items-center gap-1 relative z-10 group-hover:underline">
              Enter PIN <ChevronRight size={16} />
            </span>
          </div>
        </div>

        {/* Hero Image / Illustration */}
        <div className="mt-20 relative max-w-5xl mx-auto">
          <div className="aspect-[21/9] bg-[hsl(var(--accent))] rounded-3xl overflow-hidden relative flex items-end justify-center">
            {/* Playful background elements */}
            <div className="absolute top-10 left-10 w-24 h-24 bg-[hsl(var(--ring))/0.2] rounded-full blur-xl"></div>
            <div className="absolute bottom-20 right-20 w-32 h-32 bg-[hsl(var(--primary))/0.1] rounded-full blur-xl"></div>

            {/* Cutout style photo */}
            <img
              src="/images/aivo-trusted/hero-learner.png"
              alt="Happy learner using tablet"
              className="h-[90%] object-contain relative z-10 drop-shadow-2xl filter"
            />

            {/* Sticker decorations */}
            <div className="absolute top-1/4 left-1/4 bg-white px-4 py-2 rounded-xl shadow-lg border-2 border-slate-100 font-bold text-sm text-[hsl(var(--primary))] rotate-[-5deg] z-20 flex items-center gap-2">
              <Star className="text-yellow-400 fill-yellow-400" size={16} /> Level Up!
            </div>
            <div className="absolute top-1/3 right-1/4 bg-white p-3 rounded-full shadow-lg border-2 border-slate-100 font-bold text-sm text-[hsl(var(--primary))] rotate-[10deg] z-20">
              <Sparkles className="text-[hsl(var(--ring))]" size={24} />
            </div>
          </div>
        </div>
      </section>

      {/* Stat Block */}
      <section className="py-12 border-y border-[hsl(var(--border))] bg-[hsl(var(--accent))/0.5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x divide-[hsl(var(--border))]">
            <div className="px-4">
              <div className="text-3xl md:text-4xl font-extrabold text-[hsl(var(--primary))] mb-1">
                2,400+
              </div>
              <div className="text-sm font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                Classrooms
              </div>
            </div>
            <div className="px-4">
              <div className="text-3xl md:text-4xl font-extrabold text-[hsl(var(--primary))] mb-1">
                1.4x
              </div>
              <div className="text-sm font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                Avg. Grade-Level Gain
              </div>
            </div>
            <div className="px-4">
              <div className="text-3xl md:text-4xl font-extrabold text-[hsl(var(--primary))] mb-1">
                14
              </div>
              <div className="text-sm font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                Specialized AI Tutors
              </div>
            </div>
            <div className="px-4">
              <div className="text-3xl md:text-4xl font-extrabold text-[hsl(var(--primary))] mb-1">
                100%
              </div>
              <div className="text-sm font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                COPPA & FERPA
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Subjects Grid */}
      <section id="subjects" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-[hsl(var(--primary))] mb-4">
            Master every subject, at their own pace
          </h2>
          <p className="text-lg text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto">
            Comprehensive curriculum aligned with state standards, delivered through interactive
            lessons that adapt to neurodiverse learning styles.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-2xl p-8 border-2 border-transparent hover:border-[hsl(var(--ring))] transition-all shadow-sm hover:shadow-md cursor-pointer group">
            <div className="w-14 h-14 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Calculator size={28} />
            </div>
            <h3 className="text-xl font-bold text-[hsl(var(--primary))] mb-2">Math</h3>
            <p className="text-[hsl(var(--muted-foreground))] mb-4 text-sm">
              Visual math representations and step-by-step problem solving. Reduces working memory
              load.
            </p>
            <span className="text-[hsl(var(--ring))] font-bold text-sm">Explore Math &rarr;</span>
          </div>

          <div className="bg-white rounded-2xl p-8 border-2 border-transparent hover:border-[hsl(var(--ring))] transition-all shadow-sm hover:shadow-md cursor-pointer group">
            <div className="w-14 h-14 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <BookOpen size={28} />
            </div>
            <h3 className="text-xl font-bold text-[hsl(var(--primary))] mb-2">Reading</h3>
            <p className="text-[hsl(var(--muted-foreground))] mb-4 text-sm">
              Dyslexia-friendly typography, read-aloud support, and comprehension checks built in.
            </p>
            <span className="text-[hsl(var(--ring))] font-bold text-sm">
              Explore Reading &rarr;
            </span>
          </div>

          <div className="bg-white rounded-2xl p-8 border-2 border-transparent hover:border-[hsl(var(--ring))] transition-all shadow-sm hover:shadow-md cursor-pointer group">
            <div className="w-14 h-14 rounded-xl bg-green-100 text-green-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Search size={28} />
            </div>
            <h3 className="text-xl font-bold text-[hsl(var(--primary))] mb-2">Science</h3>
            <p className="text-[hsl(var(--muted-foreground))] mb-4 text-sm">
              Interactive experiments and clear, literal explanations of complex phenomena.
            </p>
            <span className="text-[hsl(var(--ring))] font-bold text-sm">
              Explore Science &rarr;
            </span>
          </div>

          <div className="bg-white rounded-2xl p-8 border-2 border-transparent hover:border-[hsl(var(--ring))] transition-all shadow-sm hover:shadow-md cursor-pointer group">
            <div className="w-14 h-14 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Heart size={28} />
            </div>
            <h3 className="text-xl font-bold text-[hsl(var(--primary))] mb-2">Social-Emotional</h3>
            <p className="text-[hsl(var(--muted-foreground))] mb-4 text-sm">
              Emotional regulation tools, social scripts, and guided reflection activities.
            </p>
            <span className="text-[hsl(var(--ring))] font-bold text-sm">Explore SEL &rarr;</span>
          </div>
        </div>
      </section>

      {/* Features as Outcomes */}
      <section className="py-24 bg-[hsl(var(--primary))] text-white overflow-hidden relative">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
            backgroundSize: "40px 40px",
          }}
        ></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Evidence-based features. Measurable outcomes.
            </h2>
            <p className="text-xl text-[hsl(var(--accent))] max-w-2xl mx-auto opacity-80">
              We don't just build tech, we build tools that translate to real academic and
              developmental growth.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 lg:gap-20 items-center mt-16">
            <div className="space-y-12">
              <div className="flex gap-6">
                <div className="w-12 h-12 rounded-full bg-[hsl(var(--ring))] flex items-center justify-center shrink-0">
                  <Brain size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-2">BrainClone Technology</h3>
                  <p className="text-[hsl(var(--accent))] opacity-80 mb-3">
                    An AI digital twin of the learner that adapts to how they think, retaining
                    memory of their misconceptions and breakthroughs.
                  </p>
                  <div className="bg-white/10 rounded-lg p-3 inline-block">
                    <span className="font-bold text-[hsl(var(--ring))]">Outcome:</span>{" "}
                    <span className="text-sm">
                      3x faster concept mastery by avoiding repeated redundant exercises.
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-6">
                <div className="w-12 h-12 rounded-full bg-[hsl(var(--ring))] flex items-center justify-center shrink-0">
                  <LineChart size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-2">5 Functioning Levels</h3>
                  <p className="text-[hsl(var(--accent))] opacity-80 mb-3">
                    Respectful, granular levels (from "Emerging" to "Advanced") that adjust
                    complexity, language, and interface noise automatically.
                  </p>
                  <div className="bg-white/10 rounded-lg p-3 inline-block">
                    <span className="font-bold text-[hsl(var(--ring))]">Outcome:</span>{" "}
                    <span className="text-sm">
                      60% reduction in learner frustration and session abandonment.
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-6">
                <div className="w-12 h-12 rounded-full bg-[hsl(var(--ring))] flex items-center justify-center shrink-0">
                  <ShieldCheck size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-2">IEP/504 Integration</h3>
                  <p className="text-[hsl(var(--accent))] opacity-80 mb-3">
                    Directly maps learning goals to school accommodations. Exportable progress
                    reports for IEP meetings.
                  </p>
                  <div className="bg-white/10 rounded-lg p-3 inline-block">
                    <span className="font-bold text-[hsl(var(--ring))]">Outcome:</span>{" "}
                    <span className="text-sm">
                      Seamless alignment between home, therapy, and school.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[hsl(var(--accent))] rounded-2xl p-8 text-[hsl(var(--primary))] shadow-2xl relative">
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-[hsl(var(--ring))] rounded-full flex items-center justify-center text-white font-bold text-center leading-tight shadow-lg transform rotate-12">
                Kid
                <br />
                Friendly!
              </div>
              <h3 className="text-2xl font-bold mb-6">Gamified, not addictive</h3>
              <p className="mb-6 leading-relaxed">
                Progress is rewarded with XP, streaks, and badges. But we intentionally avoid
                casino-like mechanics, flashing lights, or predatory loops that trigger
                neurodivergent hyperfocus.
              </p>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600">
                      <Trophy size={20} />
                    </div>
                    <div className="font-bold">Math Master Badge</div>
                  </div>
                  <div className="text-[hsl(var(--ring))] font-bold">+50 XP</div>
                </div>
                <div className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">
                      <Star size={20} />
                    </div>
                    <div className="font-bold">3-Day Streak</div>
                  </div>
                  <div className="text-[hsl(var(--ring))] font-bold">+20 XP</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-[hsl(var(--primary))] mb-4">
            Start learning today
          </h2>
          <p className="text-lg text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto">
            Tools for every family and classroom. AIVO is committed to keeping core learning
            accessible.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* Free Tier */}
          <div className="bg-white border-2 border-[hsl(var(--border))] rounded-2xl p-8 flex flex-col">
            <h3 className="text-2xl font-bold text-[hsl(var(--primary))] mb-2">Basic</h3>
            <div className="text-4xl font-extrabold text-[hsl(var(--primary))] mb-6">
              $0<span className="text-lg font-normal text-[hsl(var(--muted-foreground))]">/mo</span>
            </div>
            <ul className="space-y-4 mb-8 flex-1">
              <li className="flex gap-3 text-[hsl(var(--muted-foreground))]">
                <CheckCircle size={20} className="text-[hsl(var(--ring))] shrink-0" /> Access to 4
                core subjects
              </li>
              <li className="flex gap-3 text-[hsl(var(--muted-foreground))]">
                <CheckCircle size={20} className="text-[hsl(var(--ring))] shrink-0" /> Standard AI
                Tutors
              </li>
              <li className="flex gap-3 text-[hsl(var(--muted-foreground))]">
                <CheckCircle size={20} className="text-[hsl(var(--ring))] shrink-0" /> Basic
                progress tracking
              </li>
            </ul>
            <Button
              variant="outline"
              className="w-full font-bold border-2 border-[hsl(var(--primary))] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))] hover:text-white h-12 text-lg"
            >
              Sign Up Free
            </Button>
          </div>

          {/* Premium Tier */}
          <div className="bg-[hsl(var(--primary))] border-2 border-[hsl(var(--primary))] rounded-2xl p-8 flex flex-col relative transform md:-translate-y-4 shadow-xl">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[hsl(var(--ring))] text-white font-bold px-4 py-1 rounded-full text-sm uppercase tracking-wide">
              Most Popular
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Pro</h3>
            <div className="text-4xl font-extrabold text-white mb-6">
              $12<span className="text-lg font-normal text-[hsl(var(--accent))]/70">/mo</span>
            </div>
            <ul className="space-y-4 mb-8 flex-1 text-white">
              <li className="flex gap-3">
                <CheckCircle size={20} className="text-[hsl(var(--ring))] shrink-0" /> Everything in
                Basic
              </li>
              <li className="flex gap-3">
                <CheckCircle size={20} className="text-[hsl(var(--ring))] shrink-0" /> Advanced
                BrainClone adapting
              </li>
              <li className="flex gap-3">
                <CheckCircle size={20} className="text-[hsl(var(--ring))] shrink-0" /> IEP/504 goal
                tracking & export
              </li>
              <li className="flex gap-3">
                <CheckCircle size={20} className="text-[hsl(var(--ring))] shrink-0" /> All 14
                Specialized AI Tutors
              </li>
            </ul>
            <Button className="w-full font-bold bg-[hsl(var(--ring))] hover:bg-[hsl(var(--ring-hover))] text-white h-12 text-lg">
              Start 14-Day Trial
            </Button>
          </div>

          {/* District Tier */}
          <div className="bg-white border-2 border-[hsl(var(--border))] rounded-2xl p-8 flex flex-col">
            <h3 className="text-2xl font-bold text-[hsl(var(--primary))] mb-2">District</h3>
            <div className="text-4xl font-extrabold text-[hsl(var(--primary))] mb-6">Custom</div>
            <ul className="space-y-4 mb-8 flex-1">
              <li className="flex gap-3 text-[hsl(var(--muted-foreground))]">
                <CheckCircle size={20} className="text-[hsl(var(--ring))] shrink-0" /> Full
                classroom management
              </li>
              <li className="flex gap-3 text-[hsl(var(--muted-foreground))]">
                <CheckCircle size={20} className="text-[hsl(var(--ring))] shrink-0" /> District-wide
                analytics
              </li>
              <li className="flex gap-3 text-[hsl(var(--muted-foreground))]">
                <CheckCircle size={20} className="text-[hsl(var(--ring))] shrink-0" /> SIS &
                rostering integration
              </li>
              <li className="flex gap-3 text-[hsl(var(--muted-foreground))]">
                <CheckCircle size={20} className="text-[hsl(var(--ring))] shrink-0" /> Dedicated
                support team
              </li>
            </ul>
            <Button
              variant="outline"
              className="w-full font-bold border-2 border-[hsl(var(--border))] text-[hsl(var(--primary))] hover:bg-[hsl(var(--accent))] h-12 text-lg"
            >
              Contact Sales
            </Button>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-[hsl(var(--accent))] border-y border-[hsl(var(--border))]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-[hsl(var(--primary))] mb-6">
                Trusted by parents. <br />
                Loved by learners.
              </h2>
              <p className="text-lg text-[hsl(var(--muted-foreground))] mb-8">
                Hear how AIVO is transforming the educational experience for neurodiverse children
                across the country.
              </p>
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm relative">
                  <div className="text-[hsl(var(--ring))] mb-4 flex">
                    <Star size={20} className="fill-[hsl(var(--ring))]" />
                    <Star size={20} className="fill-[hsl(var(--ring))]" />
                    <Star size={20} className="fill-[hsl(var(--ring))]" />
                    <Star size={20} className="fill-[hsl(var(--ring))]" />
                    <Star size={20} className="fill-[hsl(var(--ring))]" />
                  </div>
                  <p className="italic text-[hsl(var(--foreground))] mb-4">
                    "AIVO is the first platform where my son doesn't feel 'behind'. The math tutor
                    explains things exactly how his brain needs to hear it. It's been a game-changer
                    for our homework battles."
                  </p>
                  <div className="flex items-center gap-3">
                    <img
                      src="/images/aivo-trusted/parent-1.png"
                      alt="Parent"
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div>
                      <p className="font-bold text-[hsl(var(--primary))] text-sm">
                        Aisha, parent of Malik (8, ADHD)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-square bg-[hsl(var(--primary))] rounded-full opacity-5 absolute -inset-4 z-0"></div>
              <div className="bg-white rounded-3xl p-8 shadow-xl relative z-10 border border-[hsl(var(--border))]">
                <div className="flex items-center justify-between mb-8 border-b pb-4">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="text-[hsl(var(--ring))]" size={28} />
                    <h3 className="font-bold text-xl text-[hsl(var(--primary))]">
                      Trust & Safety First
                    </h3>
                  </div>
                </div>
                <ul className="space-y-6">
                  <li className="flex gap-4">
                    <div className="mt-1 w-6 h-6 rounded-full bg-[hsl(var(--accent))] flex items-center justify-center text-[hsl(var(--primary))] font-bold text-xs shrink-0">
                      1
                    </div>
                    <div>
                      <h4 className="font-bold text-[hsl(var(--primary))]">
                        COPPA & FERPA Compliant
                      </h4>
                      <p className="text-sm text-[hsl(var(--muted-foreground))]">
                        Strict adherence to child privacy laws. We never sell data.
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-4">
                    <div className="mt-1 w-6 h-6 rounded-full bg-[hsl(var(--accent))] flex items-center justify-center text-[hsl(var(--primary))] font-bold text-xs shrink-0">
                      2
                    </div>
                    <div>
                      <h4 className="font-bold text-[hsl(var(--primary))]">Ad-Free Environment</h4>
                      <p className="text-sm text-[hsl(var(--muted-foreground))]">
                        A completely enclosed ecosystem with zero external links or advertisements.
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-4">
                    <div className="mt-1 w-6 h-6 rounded-full bg-[hsl(var(--accent))] flex items-center justify-center text-[hsl(var(--primary))] font-bold text-xs shrink-0">
                      3
                    </div>
                    <div>
                      <h4 className="font-bold text-[hsl(var(--primary))]">Parental Controls</h4>
                      <p className="text-sm text-[hsl(var(--muted-foreground))]">
                        Full visibility into chat logs, progress, and AI interactions.
                      </p>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[hsl(var(--primary))] py-12 text-white/80 text-sm border-t-8 border-[hsl(var(--ring))]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 text-white mb-6">
              <div className="w-8 h-8 rounded bg-white text-[hsl(var(--primary))] flex items-center justify-center font-bold font-serif text-xl tracking-tighter">
                A
              </div>
              <span className="font-bold text-xl tracking-tight">AIVO</span>
            </div>
            <p className="mb-4">Empowering neurodiverse learners everywhere.</p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4 uppercase tracking-wider text-xs">Learn</h4>
            <ul className="space-y-2">
              <li>
                <a href="#" className="hover:text-white">
                  Subjects
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white">
                  Pricing
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white">
                  For Districts
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4 uppercase tracking-wider text-xs">About</h4>
            <ul className="space-y-2">
              <li>
                <a href="#" className="hover:text-white">
                  Our Mission
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white">
                  Research
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white">
                  Careers
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4 uppercase tracking-wider text-xs">Legal</h4>
            <ul className="space-y-2">
              <li>
                <a href="#" className="hover:text-white">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white">
                  Trust & Safety
                </a>
              </li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
