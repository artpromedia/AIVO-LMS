import React, { useState } from "react";
import "./_group.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Mail, KeyRound, Lock, Flame, ArrowRight, ShieldCheck, Eye, EyeOff, Calculator, BookOpen, FlaskConical, Heart } from "lucide-react";

const SUBJECT_PILLS = [
  { key: "MATH",    label: "Math",    icon: Calculator,   color: "#E91E63", bg: "bg-pink-100",   text: "text-pink-700" },
  { key: "READING", label: "Reading", icon: BookOpen,     color: "#0DA2E7", bg: "bg-cyan-100",   text: "text-cyan-700" },
  { key: "SCIENCE", label: "Science", icon: FlaskConical, color: "#21C45D", bg: "bg-emerald-100",text: "text-emerald-700" },
  { key: "SEL",     label: "SEL",     icon: Heart,        color: "#FFB700", bg: "bg-amber-100",  text: "text-amber-700" },
];

const LEARNERS = [
  { name: "Leo",   tutor: "nova",    bg: "bg-violet-100",  border: "border-violet-400" },
  { name: "Maya",  tutor: "sage",    bg: "bg-emerald-100", border: "border-emerald-400" },
  { name: "Noah",  tutor: "spark",   bg: "bg-amber-100",   border: "border-amber-400" },
  { name: "Aria",  tutor: "harmony", bg: "bg-pink-100",    border: "border-pink-400" },
];

export function Auth() {
  const [tab, setTab] = useState<"email" | "pin">("email");
  const [showPwd, setShowPwd] = useState(false);
  const [selectedLearner, setSelectedLearner] = useState(0);
  const [activeSubject, setActiveSubject] = useState("MATH");
  const [pinDigits] = useState(["3","9","•","•","•","•"]);

  return (
    <div className="aivo-friendly min-h-screen bg-gradient-to-br from-[hsl(var(--primary-light))] via-white to-[hsl(var(--accent)/0.15)] flex items-center justify-center p-6 relative overflow-hidden">

      {/* Decorative blobs */}
      <div className="absolute -top-20 -left-20 w-[45vw] h-[45vw] bg-[hsl(var(--primary)/0.18)] rounded-full blur-3xl pointer-events-none aivo-blob" />
      <div className="absolute -bottom-20 -right-20 w-[40vw] h-[40vw] bg-[hsl(var(--accent)/0.25)] rounded-full blur-3xl pointer-events-none aivo-blob" style={{animationDelay:'5s'}} />
      <div className="absolute top-1/3 right-10 w-64 h-64 bg-[hsl(var(--secondary)/0.18)] rounded-full blur-3xl pointer-events-none aivo-blob" style={{animationDelay:'2s'}} />

      <div className="w-full max-w-[480px] relative z-10">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <a href="#" className="inline-flex">
            <img src="/mockup-canvas/images/aivo-brand/aivo-logo-purple.png" alt="AIVO" className="h-11 w-auto" />
          </a>
        </div>

        <Card className="p-8 rounded-[2rem] border-0 shadow-[0_20px_60px_-15px_rgba(124,58,237,0.25)] bg-white/95 backdrop-blur">

          <div className="text-center mb-7">
            <h1 className="text-3xl font-heading font-bold text-slate-900">Welcome back!</h1>
            <p className="text-slate-500 font-medium mt-1.5">Ready for today's learning adventure?</p>
          </div>

          {/* Tab Switcher */}
          <div role="tablist" aria-label="Sign in method" className="flex p-1.5 bg-slate-100 rounded-2xl mb-7">
            <button
              role="tab"
              id="tab-email"
              aria-selected={tab === "email"}
              aria-controls="panel-email"
              tabIndex={tab === "email" ? 0 : -1}
              onClick={() => setTab("email")}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                tab === "email"
                  ? "bg-white text-[hsl(var(--primary))] shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Mail className="w-4 h-4" />
              Parent / Teacher
            </button>
            <button
              role="tab"
              id="tab-pin"
              aria-selected={tab === "pin"}
              aria-controls="panel-pin"
              tabIndex={tab === "pin" ? 0 : -1}
              onClick={() => setTab("pin")}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                tab === "pin"
                  ? "bg-gradient-to-r from-[hsl(var(--accent))] to-amber-400 text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <KeyRound className="w-4 h-4" />
              Learner PIN
            </button>
          </div>

          {tab === "email" && (
            <div role="tabpanel" id="panel-email" aria-labelledby="tab-email" className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">

              {/* Streak preview */}
              <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100 rounded-2xl p-4 flex items-center gap-4">
                <div className="bg-orange-100 p-2.5 rounded-xl text-orange-500 shrink-0">
                  <Flame className="w-6 h-6 fill-current" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-orange-800">Leo is on a 12-day streak!</p>
                  <p className="text-xs font-bold text-orange-600">Nova is ready for today's math quest</p>
                </div>
                <img src="/mockup-canvas/images/tutors/nova.png" alt="Nova" className="w-10 h-10 rounded-xl object-contain bg-violet-50" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="font-bold text-slate-700 ml-1 text-sm">Email</Label>
                <div className="relative">
                  <Mail className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="parent@example.com"
                    defaultValue=""
                    className="h-14 pl-12 rounded-2xl bg-slate-50 border-2 border-slate-100 focus-visible:bg-white focus-visible:border-[hsl(var(--primary))] focus-visible:ring-4 focus-visible:ring-[hsl(var(--primary)/0.15)] font-medium"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <Label htmlFor="password" className="font-bold text-slate-700 text-sm">Password</Label>
                  <a href="#" className="text-sm font-bold text-[hsl(var(--primary))] hover:underline">Forgot?</a>
                </div>
                <div className="relative">
                  <Lock className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <Input
                    id="password"
                    type={showPwd ? "text" : "password"}
                    placeholder="Enter your password"
                    className="h-14 pl-12 pr-12 rounded-2xl bg-slate-50 border-2 border-slate-100 focus-visible:bg-white focus-visible:border-[hsl(var(--primary))] focus-visible:ring-4 focus-visible:ring-[hsl(var(--primary)/0.15)] font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={showPwd ? "Hide password" : "Show password"}
                  >
                    {showPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <Button className="w-full h-14 rounded-2xl bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary-dark))] hover:opacity-90 text-white font-bold text-lg mt-2 shadow-xl shadow-purple-200 transition-transform hover:-translate-y-0.5">
                Sign In
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          )}

          {tab === "pin" && (
            <div role="tabpanel" id="panel-pin" aria-labelledby="tab-pin" className="space-y-7 animate-in fade-in slide-in-from-bottom-2 duration-300">

              {/* Learner picker */}
              <div className="text-center">
                <p className="font-bold text-slate-700 mb-4 text-sm">Who's learning today?</p>
                <div className="flex justify-center gap-3">
                  {LEARNERS.map((l, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedLearner(idx)}
                      className={`flex flex-col items-center gap-1.5 transition-all ${
                        selectedLearner === idx ? "scale-110" : "opacity-70 hover:opacity-100"
                      }`}
                    >
                      <div className={`w-16 h-16 rounded-2xl ${l.bg} border-4 ${
                        selectedLearner === idx ? l.border + " shadow-lg" : "border-transparent"
                      } flex items-center justify-center overflow-hidden`}>
                        <img src={`/mockup-canvas/images/tutors/${l.tutor}.png`} alt={l.name} className="w-12 h-12 object-contain" />
                      </div>
                      <span className={`text-xs font-bold ${selectedLearner === idx ? "text-slate-900" : "text-slate-500"}`}>{l.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject pills */}
              <div>
                <p className="font-bold text-slate-700 mb-3 text-sm text-center">What sounds fun?</p>
                <div className="flex justify-center gap-2 flex-wrap">
                  {SUBJECT_PILLS.map((s) => {
                    const Icon = s.icon;
                    const active = activeSubject === s.key;
                    return (
                      <button
                        key={s.key}
                        onClick={() => setActiveSubject(s.key)}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-bold border-2 transition-all ${
                          active
                            ? `${s.bg} ${s.text} border-current shadow-sm scale-105`
                            : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* PIN entry */}
              <div>
                <p className="font-bold text-slate-700 mb-3 text-sm text-center">Enter your secret PIN</p>
                <div className="flex justify-center gap-2">
                  {pinDigits.map((d, i) => (
                    <div
                      key={i}
                      className={`w-11 h-14 rounded-2xl border-2 flex items-center justify-center text-2xl font-heading font-bold transition-all ${
                        d !== "•" && d !== ""
                          ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary-light))] text-[hsl(var(--primary-dark))]"
                          : d === "•"
                            ? "border-slate-300 bg-slate-50 text-slate-700"
                            : "border-slate-200 bg-slate-50 text-slate-300"
                      }`}
                    >
                      {d}
                    </div>
                  ))}
                </div>
              </div>

              <Button className="w-full h-14 rounded-2xl bg-gradient-to-r from-[hsl(var(--accent))] to-amber-400 hover:opacity-90 text-slate-900 font-bold text-lg shadow-xl shadow-amber-100 transition-transform hover:-translate-y-0.5">
                Let's Go!
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>

            </div>
          )}

        </Card>

        {/* Trust Signal */}
        <div className="text-center mt-7">
          <div className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 bg-white/70 backdrop-blur px-4 py-2 rounded-full border border-slate-200">
            <ShieldCheck className="w-4 h-4 text-[hsl(var(--primary))]" />
            COPPA · FERPA · SOC 2 Compliant
          </div>
          <p className="text-sm font-medium text-slate-500 mt-5">
            New to AIVO? <a href="#" className="text-[hsl(var(--primary))] font-bold hover:underline">Start your free trial</a>
          </p>
        </div>

      </div>
    </div>
  );
}
