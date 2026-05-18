import React from "react";
import "./_group.css";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Star,
  ShieldCheck,
  Heart,
  Sparkles,
  Brain,
  Lock,
  CheckCircle2,
  BookOpen,
  Users,
  ArrowRight,
  Flame,
  Zap,
  BarChart3,
  MapPin,
  Eye,
  Layers,
  RefreshCw,
  Network,
} from "lucide-react";

const TUTORS = [
  {
    name: "Nova",
    domain: "Mathematics",
    color: "#7C3AED",
    img: "/mockup-canvas/images/tutors/nova.png",
    tagline: "Numbers come alive with Nova.",
  },
  {
    name: "Sage",
    domain: "English Language Arts",
    color: "#10B981",
    img: "/mockup-canvas/images/tutors/sage.png",
    tagline: "Every child has a story worth telling.",
  },
  {
    name: "Spark",
    domain: "Science",
    color: "#F59E0B",
    img: "/mockup-canvas/images/tutors/spark.png",
    tagline: "Curiosity is the best experiment.",
  },
  {
    name: "Chrono",
    domain: "History & Social Studies",
    color: "#6366F1",
    img: "/mockup-canvas/images/tutors/chrono.png",
    tagline: "Travel through time, one lesson at a time.",
  },
  {
    name: "Pixel",
    domain: "Coding & Technology",
    color: "#06B6D4",
    img: "/mockup-canvas/images/tutors/pixel.png",
    tagline: "Build the future, one block at a time.",
  },
  {
    name: "Echo",
    domain: "Speech & Communication",
    color: "#EC4899",
    img: "/mockup-canvas/images/tutors/echo.png",
    tagline: "Find your voice, at your own pace.",
  },
  {
    name: "Harmony",
    domain: "Social-Emotional Learning",
    color: "#8B5CF6",
    img: "/mockup-canvas/images/tutors/harmony.png",
    tagline: "Feelings are superpowers when you understand them.",
  },
  {
    name: "Atlas",
    domain: "Geography & World Studies",
    color: "#14B8A6",
    img: "/mockup-canvas/images/tutors/atlas.png",
    tagline: "Explore every corner of the world.",
  },
  {
    name: "Cadence",
    domain: "Music & Rhythm",
    color: "#D946EF",
    img: "/mockup-canvas/images/tutors/cadence.png",
    tagline: "Every learner has a rhythm inside.",
  },
  {
    name: "Vigor",
    domain: "Physical Education & Wellness",
    color: "#22C55E",
    img: "/mockup-canvas/images/tutors/vigor.png",
    tagline: "Move, play, and grow stronger.",
  },
  {
    name: "Lingua",
    domain: "World Languages",
    color: "#EF4444",
    img: "/mockup-canvas/images/tutors/lingua.png",
    tagline: "Open doors with every new word.",
  },
  {
    name: "Forge",
    domain: "STEM & Engineering",
    color: "#92400E",
    img: "/mockup-canvas/images/tutors/forge.png",
    tagline: "Design, build, and engineer the future.",
  },
  {
    name: "Compass",
    domain: "Executive Function & Life Skills",
    color: "#1E40AF",
    img: "/mockup-canvas/images/tutors/compass.png",
    tagline: "Navigate life with confidence.",
  },
  {
    name: "Muse",
    domain: "Creative Arts & Expression",
    color: "#A855F7",
    img: "/mockup-canvas/images/tutors/muse.png",
    tagline: "Create without limits.",
  },
];

const FUNCTIONING_LEVELS = [
  {
    level: "1",
    title: "Standard",
    desc: "Grade-level academics with adaptive pacing and enrichment opportunities.",
  },
  {
    level: "2",
    title: "Supported",
    desc: "Modified curriculum with additional scaffolding and visual supports.",
  },
  {
    level: "3",
    title: "Guided",
    desc: "Structured learning with step-by-step guidance and sensory accommodations.",
  },
  {
    level: "4",
    title: "Exploratory",
    desc: "Cause-and-effect learning with high-contrast visuals and switch access.",
  },
  {
    level: "5",
    title: "Pre-Symbolic",
    desc: "Sensory engagement and early communication through guided interaction.",
  },
];

export function Marketing() {
  return (
    <div className="aivo-friendly min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary-dark))] text-white py-2.5 px-4 text-center text-sm font-bold flex items-center justify-center gap-2">
        <ShieldCheck className="w-4 h-4" />
        COPPA & FERPA Compliant · SOC 2 Certified · 100% ad-free
      </div>

      {/* Navigation */}
      <nav className="border-b border-slate-100 bg-white/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <a href="#" className="flex items-center gap-2.5">
            <img
              src="/mockup-canvas/images/aivo-brand/aivo-logo-purple.png"
              alt="AIVO"
              className="h-9 w-auto"
            />
          </a>
          <div className="hidden md:flex gap-8 text-base font-bold text-slate-600">
            <a href="#features" className="hover:text-[hsl(var(--primary))] transition-colors">
              Features
            </a>
            <a href="#tutors" className="hover:text-[hsl(var(--primary))] transition-colors">
              Tutors
            </a>
            <a href="#brain" className="hover:text-[hsl(var(--primary))] transition-colors">
              Brain Clone
            </a>
            <a href="#pricing" className="hover:text-[hsl(var(--primary))] transition-colors">
              Pricing
            </a>
          </div>
          <div className="flex gap-3">
            <Button
              variant="ghost"
              className="text-[hsl(var(--primary))] font-bold text-base hover:bg-[hsl(var(--primary-light))] rounded-full px-5"
            >
              Sign In
            </Button>
            <Button className="bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary-dark))] hover:opacity-90 text-white font-bold text-base rounded-full px-6 shadow-md shadow-purple-200 border-0">
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative px-6 py-16 md:py-24 overflow-hidden">
        <div className="absolute inset-0 -z-0">
          <div className="absolute top-10 -left-10 w-[40vw] h-[40vw] bg-[hsl(var(--primary-light))] rounded-full blur-3xl opacity-70 aivo-blob" />
          <div
            className="absolute bottom-0 -right-10 w-[35vw] h-[35vw] bg-[hsl(var(--accent)/0.18)] rounded-full blur-3xl aivo-blob"
            style={{ animationDelay: "4s" }}
          />
        </div>
        <div className="relative max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 space-y-7 text-center md:text-left">
            <Badge className="bg-[hsl(var(--primary-light))] text-[hsl(var(--primary-dark))] hover:bg-[hsl(var(--primary-light))] border-none font-bold px-4 py-1.5 rounded-full text-sm">
              <Sparkles className="w-4 h-4 mr-2" />
              The adaptive learning platform
            </Badge>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-heading font-bold text-slate-900 leading-[1.05] tracking-tight">
              Learning adventures
              <br />
              <span className="text-[hsl(var(--primary))]">for every mind.</span>
            </h1>
            <p className="text-xl text-slate-600 font-medium leading-relaxed max-w-xl mx-auto md:mx-0">
              AIVO meets each learner where they are from standard curriculum to pre-symbolic
              communication with <span className="font-bold text-slate-800">14 AI tutors</span> and{" "}
              <span className="font-bold text-slate-800">Brain Clone</span> technology that truly
              adapts.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start pt-2">
              <Button className="bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary-dark))] hover:opacity-90 text-white font-bold px-8 py-7 rounded-full text-lg shadow-xl shadow-purple-200 border-0 transition-transform hover:-translate-y-0.5">
                Start Free Trial
                <ArrowRight className="w-5 h-5 ml-1" />
              </Button>
              <Button
                variant="outline"
                className="border-2 border-slate-200 text-slate-700 font-bold px-8 py-7 rounded-full text-lg hover:bg-slate-50 hover:border-slate-300 transition-transform hover:-translate-y-0.5"
              >
                Sign In
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-4 pt-4 justify-center md:justify-start text-sm font-bold text-slate-500">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[hsl(var(--success))]" />
                No credit card
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[hsl(var(--success))]" />
                COPPA-safe
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[hsl(var(--success))]" />
                IEP-aware
              </span>
            </div>
          </div>
          <div className="flex-1 w-full max-w-lg md:max-w-none relative">
            {/* Streak badge */}
            <div
              className="absolute -top-4 -right-4 z-20 bg-white p-4 rounded-2xl shadow-2xl border border-slate-100 rotate-3 aivo-float"
              style={{ animationDelay: "0.5s" }}
            >
              <div className="flex items-center gap-3">
                <div className="bg-orange-100 text-orange-500 p-2 rounded-xl">
                  <Flame className="w-6 h-6 fill-current" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Streak</p>
                  <p className="text-xl font-heading font-bold text-slate-800">12 days!</p>
                </div>
              </div>
            </div>
            {/* Tutor badge */}
            <div className="absolute -bottom-4 -left-4 z-20 bg-white p-3 pr-5 rounded-2xl shadow-2xl border border-slate-100 -rotate-3 aivo-float flex items-center gap-3">
              <img
                src="/mockup-canvas/images/tutors/nova.png"
                alt="Nova"
                className="w-10 h-10 rounded-full object-cover bg-violet-100"
              />
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                  Now learning
                </p>
                <p className="text-sm font-heading font-bold text-slate-800">Nova · Math</p>
              </div>
            </div>
            <div className="rounded-[2rem] overflow-hidden shadow-2xl border-4 border-white">
              <img
                src="/mockup-canvas/images/aivo-brand/arab-boy-chromebook.webp"
                alt="Learner using AIVO"
                className="w-full h-auto object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="bg-white border-y border-slate-100">
        <div className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { value: "14", label: "AI Tutors", icon: "👨‍🏫" },
            { value: "5", label: "Functioning Levels", icon: "🎮" },
            { value: "10", label: "Languages", icon: "🌍" },
            { value: "24/7", label: "Adaptive Learning", icon: "🧠" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl mb-1">{s.icon}</div>
              <p className="text-3xl md:text-4xl font-heading font-bold text-[hsl(var(--primary))]">
                {s.value}
              </p>
              <p className="text-sm text-slate-500 font-bold mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <Badge className="bg-[hsl(var(--primary-light))] text-[hsl(var(--primary-dark))] hover:bg-[hsl(var(--primary-light))] border-none font-bold px-4 py-1.5 rounded-full text-sm mb-4">
              Why AIVO
            </Badge>
            <h2 className="text-4xl md:text-5xl font-heading font-bold text-slate-900 leading-tight mb-4">
              Built different, on purpose.
            </h2>
            <p className="text-lg text-slate-600 font-medium">
              Every feature is designed around the learner not a one-size-fits-all curriculum.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Layers,
                title: "5 Functioning Levels",
                desc: "From standard academics to pre-symbolic cause-and-effect, every child has a path designed just for them.",
                color: "bg-violet-100 text-violet-600",
              },
              {
                icon: Users,
                title: "14 AI Tutors",
                desc: "Seven core tutors plus seven specialists, each with a unique personality covering every learning domain.",
                color: "bg-cyan-100 text-cyan-600",
              },
              {
                icon: Brain,
                title: "Brain Clone",
                desc: "An adaptive brain state that evolves with each learner with snapshots, rollback, and continuous growth.",
                color: "bg-amber-100 text-amber-600",
              },
              {
                icon: MapPin,
                title: "Region-Smart Curriculum",
                desc: "Dynamic curriculum aligned to your zip code and regional standards, automatically personalized to local requirements.",
                color: "bg-emerald-100 text-emerald-600",
              },
              {
                icon: Eye,
                title: "Sensory Profiles",
                desc: "Adapts visuals, audio, and interactions based on each learner's sensory preferences and needs.",
                color: "bg-pink-100 text-pink-600",
              },
              {
                icon: BarChart3,
                title: "Real-Time Analytics",
                desc: "Parents, teachers, and therapists get live dashboards showing progress, mastery, and growth over time.",
                color: "bg-indigo-100 text-indigo-600",
              },
            ].map((f, i) => {
              const Icon = f.icon;
              return (
                <Card
                  key={i}
                  className="p-7 rounded-3xl border-2 border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all bg-white"
                >
                  <div
                    className={`w-14 h-14 ${f.color} rounded-2xl flex items-center justify-center mb-5`}
                  >
                    <Icon className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-heading font-bold mb-2 text-slate-900">{f.title}</h3>
                  <p className="text-slate-600 font-medium leading-relaxed">{f.desc}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-24 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none font-bold px-4 py-1.5 rounded-full text-sm mb-4">
            Getting Started
          </Badge>
          <h2 className="text-4xl md:text-5xl font-heading font-bold text-slate-900 leading-tight mb-4">
            Four steps to personalized learning.
          </h2>
          <p className="text-lg text-slate-600 font-medium">
            From signup to adaptive curriculum in minutes, not months.
          </p>
        </div>
        <div className="grid md:grid-cols-4 gap-6">
          {[
            {
              num: "1",
              title: "Parent Assessment",
              desc: "Parents share their child's needs, communication style, and learning preferences in a quick questionnaire.",
            },
            {
              num: "2",
              title: "Baseline Discovery",
              desc: "Your child plays through a fun interactive assessment to establish their starting point.",
            },
            {
              num: "3",
              title: "Brain Clone Created",
              desc: "AIVO builds a personalized learning brain that understands strengths, challenges, and preferred ways to learn.",
            },
            {
              num: "4",
              title: "Adaptive Learning",
              desc: "14 AI tutors deliver personalized lessons that adapt in real-time, getting smarter with every interaction.",
            },
          ].map((s, i) => (
            <div key={i} className="relative">
              <div className="bg-white border-2 border-slate-100 rounded-3xl p-6 h-full hover:border-[hsl(var(--primary))] transition-colors">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary-dark))] text-white font-heading font-bold flex items-center justify-center text-xl mb-4 shadow-lg shadow-purple-200">
                  {s.num}
                </div>
                <h3 className="font-heading font-bold text-lg text-slate-900 mb-2">{s.title}</h3>
                <p className="text-sm text-slate-600 font-medium leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Brain Clone */}
      <section
        id="brain"
        className="py-24 px-6 bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary-dark))] text-white relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 right-20 w-64 h-64 bg-[hsl(var(--accent))] rounded-full blur-3xl aivo-blob" />
          <div
            className="absolute bottom-10 left-20 w-72 h-72 bg-[hsl(var(--secondary))] rounded-full blur-3xl aivo-blob"
            style={{ animationDelay: "6s" }}
          />
        </div>
        <div className="relative max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <Badge className="bg-white/20 text-white hover:bg-white/20 border-none font-bold px-4 py-1.5 rounded-full text-sm backdrop-blur">
              <Sparkles className="w-4 h-4 mr-2" />
              Core Technology
            </Badge>
            <h2 className="text-4xl md:text-5xl font-heading font-bold leading-tight">
              The Brain Clone.
              <br />A digital twin of how your child learns.
            </h2>
            <p className="text-lg text-white/85 font-medium leading-relaxed">
              A living digital model of your child's learning mind. It grows, adapts, and remembers
              so every lesson picks up exactly where they left off.
            </p>
            <div className="grid sm:grid-cols-2 gap-4 pt-4">
              {[
                {
                  icon: RefreshCw,
                  title: "Continuous Adaptation",
                  desc: "Evolves with every interaction adjusting difficulty, pace, and teaching style.",
                },
                {
                  icon: Zap,
                  title: "Snapshots & Rollback",
                  desc: "Save brain states at milestones. Roll back if something isn't working.",
                },
                {
                  icon: Layers,
                  title: "Multi-Dimensional",
                  desc: "Tracks cognitive, behavioral, communication, and academic domains.",
                },
                {
                  icon: Network,
                  title: "Cross-Tutor Memory",
                  desc: "What one tutor learns, all tutors know one unified experience.",
                },
              ].map((f, i) => {
                const Icon = f.icon;
                return (
                  <div key={i} className="flex gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-heading font-bold text-base mb-1">{f.title}</p>
                      <p className="text-sm text-white/75 font-medium leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="relative">
            <div className="bg-white rounded-3xl p-8 shadow-2xl text-slate-900 aivo-float">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary-dark))] flex items-center justify-center text-white">
                  <Brain className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Brain Clone
                  </p>
                  <p className="font-heading font-bold text-lg">Leo, age 9</p>
                </div>
                <Badge className="ml-auto bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none font-bold">
                  Live
                </Badge>
              </div>
              <div className="space-y-4">
                {[
                  { label: "Math reasoning", value: 78, color: "bg-violet-500" },
                  { label: "Reading fluency", value: 64, color: "bg-emerald-500" },
                  { label: "Sensory regulation", value: 92, color: "bg-amber-500" },
                  { label: "Social-emotional", value: 71, color: "bg-pink-500" },
                ].map((m) => (
                  <div key={m.label}>
                    <div className="flex justify-between text-sm font-bold text-slate-700 mb-1.5">
                      <span>{m.label}</span>
                      <span>{m.value}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full ${m.color} rounded-full`}
                        style={{ width: `${m.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-5 border-t border-slate-100 flex items-center gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-bold text-slate-700">
                  Adapting in real time across 4 tutors
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tutor Showcase */}
      <section id="tutors" className="py-24 bg-slate-50 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 mb-12 text-center">
          <Badge className="bg-cyan-100 text-cyan-700 hover:bg-cyan-100 border-none font-bold px-4 py-1.5 rounded-full text-sm mb-4">
            Your child's team
          </Badge>
          <h2 className="text-4xl md:text-5xl font-heading font-bold mb-4 text-slate-900">
            Meet the AI Learning Team
          </h2>
          <p className="text-lg font-medium text-slate-600 max-w-2xl mx-auto">
            Fourteen specialized AI tutors, each with a unique personality and teaching style
            designed to make every subject engaging.
          </p>
        </div>

        <div className="flex gap-5 px-6 pb-8 overflow-x-auto snap-x hide-scrollbar">
          <div className="w-4 shrink-0" />
          {TUTORS.map((tutor, i) => (
            <Card
              key={i}
              className="shrink-0 w-[280px] snap-center p-6 rounded-3xl border-2 border-white bg-white shadow-md hover:shadow-xl transition-all hover:-translate-y-1 group"
            >
              <div
                className="w-full h-36 rounded-2xl mb-5 relative overflow-hidden flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${tutor.color}22, ${tutor.color}44)`,
                }}
              >
                <img
                  src={tutor.img}
                  alt={tutor.name}
                  className="w-28 h-28 object-contain group-hover:scale-110 transition-transform"
                />
              </div>
              <Badge
                className="border-none font-bold mb-2"
                style={{ backgroundColor: `${tutor.color}15`, color: tutor.color }}
              >
                {tutor.domain}
              </Badge>
              <h3 className="text-xl font-heading font-bold text-slate-900 mb-1">{tutor.name}</h3>
              <p className="text-sm text-slate-600 font-medium leading-relaxed">{tutor.tagline}</p>
            </Card>
          ))}
          <div className="w-4 shrink-0" />
        </div>
      </section>

      {/* Functioning Levels */}
      <section id="levels" className="py-24 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none font-bold px-4 py-1.5 rounded-full text-sm mb-4">
            Built for every learner
          </Badge>
          <h2 className="text-4xl md:text-5xl font-heading font-bold text-slate-900 mb-4 leading-tight">
            Five functioning levels, one platform.
          </h2>
          <p className="text-lg text-slate-600 font-medium">
            We use respectful, sensitive language and adapt the entire interface to match your
            child's current needs.
          </p>
        </div>

        <div className="grid md:grid-cols-5 gap-4">
          {FUNCTIONING_LEVELS.map((l, i) => (
            <div
              key={i}
              className="bg-white border-2 border-slate-100 p-6 rounded-3xl hover:border-[hsl(var(--primary))] hover:shadow-md transition-all text-left"
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary-dark))] text-white font-heading font-bold flex items-center justify-center text-lg mb-4 shadow-md shadow-purple-200">
                {l.level}
              </div>
              <h3 className="font-heading font-bold text-lg text-slate-900 mb-2">{l.title}</h3>
              <p className="text-sm text-slate-600 font-medium leading-relaxed">{l.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-slate-50 py-24 px-6 border-y border-slate-100">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <Badge className="bg-pink-100 text-pink-700 hover:bg-pink-100 border-none font-bold px-4 py-1.5 rounded-full text-sm mb-4">
              <Heart className="w-4 h-4 mr-2 fill-current" />
              Loved by families
            </Badge>
            <h2 className="text-4xl md:text-5xl font-heading font-bold text-slate-900 leading-tight">
              Real stories, real growth.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                quote:
                  "My son went from refusing to touch a tablet to eagerly asking for 'brain time' every morning. AIVO understood his sensory needs from day one.",
                name: "Parent of Level 3 Learner",
                role: "Washington, DC",
                initial: "A",
                color: "bg-violet-100 text-violet-700",
              },
              {
                quote:
                  "As a special education teacher, I've never seen a platform that adapts this deeply. The brain clone gives me insights I couldn't get from any assessment alone.",
                name: "Special Education Director",
                role: "Chicago, IL",
                initial: "D",
                color: "bg-cyan-100 text-cyan-700",
              },
              {
                quote:
                  "We deployed AIVO across 12 schools in our district. The IEP integration alone saved our teachers 10+ hours per student per quarter.",
                name: "District Administrator",
                role: "Minneapolis, MN",
                initial: "M",
                color: "bg-amber-100 text-amber-700",
              },
              {
                quote:
                  "My daughter has autism and communicates through AAC. AIVO's tutors work seamlessly with her device. She's learning math concepts we didn't think possible.",
                name: "Parents of Level 4 Learner",
                role: "Dallas, TX",
                initial: "J",
                color: "bg-emerald-100 text-emerald-700",
              },
            ].map((t, i) => (
              <Card
                key={i}
                className="p-8 rounded-3xl border-2 border-slate-100 bg-white shadow-sm"
              >
                <div className="flex gap-1 text-[hsl(var(--accent))] mb-5">
                  {[0, 1, 2, 3, 4].map((s) => (
                    <Star key={s} className="w-5 h-5 fill-current" />
                  ))}
                </div>
                <p className="text-lg text-slate-700 font-medium leading-relaxed mb-6">
                  "{t.quote}"
                </p>
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 ${t.color} rounded-full flex items-center justify-center font-bold text-xl`}
                  >
                    {t.initial}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{t.name}</p>
                    <p className="text-sm text-slate-500 font-medium">{t.role}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <Badge className="bg-[hsl(var(--primary-light))] text-[hsl(var(--primary-dark))] hover:bg-[hsl(var(--primary-light))] border-none font-bold px-4 py-1.5 rounded-full text-sm mb-4">
            Simple Pricing
          </Badge>
          <h2 className="text-4xl md:text-5xl font-heading font-bold text-slate-900 mb-4 leading-tight">
            Plans for every family.
          </h2>
          <p className="text-lg text-slate-600 font-medium">
            Start free, upgrade when you're ready. No contracts, cancel anytime.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              name: "Free Trial",
              price: "Free",
              desc: "Try AIVO with one learner, no credit card required.",
              features: [
                "1 learner profile",
                "ELA tutor only (Sage)",
                "Basic brain clone",
                "Parent dashboard",
              ],
              cta: "Start Free",
              highlight: false,
            },
            {
              name: "Single Learner",
              price: "$24.99",
              per: "/mo per learner",
              desc: "Full access for one learner with core tutors included.",
              features: [
                "1 learner profile",
                "ELA + Math tutors",
                "2 core tutors included",
                "Full brain clone",
                "Add tutors at $4.99/mo each",
              ],
              cta: "Start Free Trial",
              highlight: false,
            },
            {
              name: "Family",
              price: "$19.99",
              per: "/mo per learner",
              desc: "Best per-learner price, designed for families with 2+ learners.",
              features: [
                "2+ learner profiles (up to 10)",
                "ELA + Math tutors",
                "2 core tutors included",
                "Full brain clone",
                "Multi-learner discount",
              ],
              cta: "Start Free Trial",
              highlight: true,
            },
          ].map((p, i) => (
            <Card
              key={i}
              className={`p-8 rounded-3xl border-2 transition-all ${p.highlight ? "border-[hsl(var(--primary))] shadow-2xl shadow-purple-100 -translate-y-2 relative" : "border-slate-100 shadow-sm hover:shadow-md"}`}
            >
              {p.highlight && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[hsl(var(--accent))] text-slate-900 hover:bg-[hsl(var(--accent))] border-none font-bold px-4 py-1 rounded-full">
                  Best Value
                </Badge>
              )}
              <h3 className="font-heading font-bold text-2xl text-slate-900">{p.name}</h3>
              <div className="flex items-baseline gap-1 mt-3 mb-4">
                <span className="text-4xl font-heading font-bold text-slate-900">{p.price}</span>
                {p.per && <span className="text-sm text-slate-500 font-bold">{p.per}</span>}
              </div>
              <p className="text-slate-600 font-medium mb-6 min-h-[3rem]">{p.desc}</p>
              <ul className="space-y-3 mb-8">
                {p.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-2 text-slate-700 font-medium">
                    <CheckCircle2 className="w-5 h-5 text-[hsl(var(--success))] shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                className={`w-full h-12 rounded-2xl font-bold ${p.highlight ? "bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary-dark))] text-white hover:opacity-90" : "bg-slate-900 text-white hover:bg-slate-800"}`}
              >
                {p.cta}
              </Button>
            </Card>
          ))}
        </div>
        <div className="mt-10 bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 md:p-10 flex flex-col md:flex-row items-center gap-6 text-white">
          <div className="flex-1">
            <Badge className="bg-[hsl(var(--accent))] text-slate-900 hover:bg-[hsl(var(--accent))] border-none font-bold mb-3">
              For Schools & Districts
            </Badge>
            <h3 className="text-2xl md:text-3xl font-heading font-bold mb-2">AIVO for Education</h3>
            <p className="text-white/80 font-medium leading-relaxed max-w-xl">
              Bring AIVO to your entire school or district with volume pricing, all 14 tutors, IEP
              tracking, admin dashboard, and dedicated support.
            </p>
          </div>
          <Button className="bg-white text-slate-900 hover:bg-slate-100 font-bold px-8 py-6 rounded-full text-base shrink-0">
            Contact Sales
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center bg-gradient-to-br from-[hsl(var(--primary-light))] to-white rounded-[3rem] p-12 md:p-16 border-2 border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-64 h-64 bg-[hsl(var(--accent)/0.3)] rounded-full blur-3xl" />
          <div className="relative space-y-6">
            <h2 className="text-4xl md:text-5xl font-heading font-bold text-slate-900 leading-tight">
              Every child deserves a learning experience
              <br className="hidden md:block" /> built just for them.
            </h2>
            <p className="text-lg text-slate-600 font-medium max-w-xl mx-auto">
              Join thousands of families discovering what personalized, adaptive learning can do.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
              <Button className="bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary-dark))] hover:opacity-90 text-white font-bold px-10 py-7 rounded-full text-lg shadow-xl shadow-purple-200">
                Start Your Free Trial
                <ArrowRight className="w-5 h-5 ml-1" />
              </Button>
              <Button
                variant="outline"
                className="border-2 border-slate-200 text-slate-700 font-bold px-10 py-7 rounded-full text-lg hover:bg-white"
              >
                View Pricing
              </Button>
            </div>
            <p className="text-sm text-slate-500 font-bold pt-2">
              No credit card required · Cancel anytime
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-16 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-5 gap-8 mb-12">
          <div className="md:col-span-2">
            <img
              src="/mockup-canvas/images/aivo-brand/aivo-logo-white.png"
              alt="AIVO"
              className="h-9 w-auto mb-5"
            />
            <p className="max-w-xs leading-relaxed font-medium">
              AI-powered adaptive learning for every child, every mind, every potential.
            </p>
            <div className="flex items-center gap-2 mt-6 bg-slate-800 w-fit px-4 py-2 rounded-xl">
              <Lock className="w-4 h-4 text-[hsl(var(--success))]" />
              <span className="text-sm font-bold text-slate-300">COPPA · FERPA · SOC 2</span>
            </div>
          </div>
          <div>
            <h4 className="text-white font-heading font-bold mb-4">Platform</h4>
            <ul className="space-y-3 text-sm font-medium">
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  AI Tutors
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Brain Clone
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Pricing
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-heading font-bold mb-4">Solutions</h4>
            <ul className="space-y-3 text-sm font-medium">
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  For Families
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  For Schools
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  For Districts
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  IEP Integration
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-heading font-bold mb-4">Legal</h4>
            <ul className="space-y-3 text-sm font-medium">
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  COPPA
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  FERPA
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto border-t border-slate-800 pt-8 flex flex-col md:flex-row gap-3 justify-between text-sm font-medium">
          <span>© {new Date().getFullYear()} AIVO Learning Platform. All rights reserved.</span>
          <span>Built with care for every learner.</span>
        </div>
      </footer>
    </div>
  );
}
