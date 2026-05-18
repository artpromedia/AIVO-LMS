"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  KeyRound,
  Loader2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Flame,
  Calculator,
  BookOpen,
  FlaskConical,
  Heart,
  Info,
} from "lucide-react";

const SUBJECT_PILLS = [
  {
    key: "MATH",
    label: "Math",
    Icon: Calculator,
    bg: "bg-pink-100",
    text: "text-pink-700",
    border: "border-pink-300",
  },
  {
    key: "READING",
    label: "Reading",
    Icon: BookOpen,
    bg: "bg-cyan-100",
    text: "text-cyan-700",
    border: "border-cyan-300",
  },
  {
    key: "SCIENCE",
    label: "Science",
    Icon: FlaskConical,
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    border: "border-emerald-300",
  },
  {
    key: "SEL",
    label: "Feelings",
    Icon: Heart,
    bg: "bg-amber-100",
    text: "text-amber-700",
    border: "border-amber-300",
  },
] as const;

const LEARNERS = [
  {
    name: "Leo",
    tutor: "nova",
    subject: "math",
    days: 12,
    subtitle: "Algebra adventure ready when you are.",
    bg: "bg-violet-100",
    border: "border-violet-400",
    avatarBg: "bg-violet-50",
  },
  {
    name: "Maya",
    tutor: "sage",
    subject: "reading",
    days: 8,
    subtitle: "Three new stories unlocked this week.",
    bg: "bg-emerald-100",
    border: "border-emerald-400",
    avatarBg: "bg-emerald-50",
  },
  {
    name: "Noah",
    tutor: "spark",
    subject: "science",
    days: 21,
    subtitle: "Lab experiment waiting to begin.",
    bg: "bg-amber-100",
    border: "border-amber-400",
    avatarBg: "bg-amber-50",
  },
  {
    name: "Aria",
    tutor: "harmony",
    subject: "sel",
    days: 5,
    subtitle: "Mood check-in and a calm-down game.",
    bg: "bg-pink-100",
    border: "border-pink-400",
    avatarBg: "bg-pink-50",
  },
] as const;

function getDailyLearnerIndex(): number {
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  return ((dayIndex % LEARNERS.length) + LEARNERS.length) % LEARNERS.length;
}

export default function LoginPage() {
  const [mode, setMode] = useState<"email" | "pin">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [parentId, setParentId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedLearner, setSelectedLearner] = useState(0);
  const [activeSubject, setActiveSubject] = useState<string>("MATH");
  const [streakIdx, setStreakIdx] = useState<number>(0);

  useEffect(() => {
    setStreakIdx(getDailyLearnerIndex());
  }, []);

  const previewLearner = LEARNERS[streakIdx];

  const simulateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    await new Promise((r) => setTimeout(r, 700));
    setLoading(false);
    setInfo("Demo mode — this is a preview of the new sign-in design. The live app launches soon.");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-100 via-white to-amber-50 flex flex-col relative overflow-hidden">
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none -z-0">
        <div className="absolute -top-20 -left-20 w-[45vw] h-[45vw] bg-violet-300/40 rounded-full blur-3xl animate-blob motion-reduce:animate-none" />
        <div
          className="absolute -bottom-20 -right-20 w-[40vw] h-[40vw] bg-amber-200/50 rounded-full blur-3xl animate-blob motion-reduce:animate-none"
          style={{ animationDelay: "5s" }}
        />
        <div
          className="absolute top-1/3 right-10 w-64 h-64 bg-cyan-200/40 rounded-full blur-3xl animate-blob motion-reduce:animate-none"
          style={{ animationDelay: "2s" }}
        />
      </div>

      <header className="relative z-30 flex items-center justify-between p-6">
        <Link href="/" aria-label="AIVO home">
          <Image
            src="/images/aivo-logo-purple.png"
            alt="AIVO"
            width={120}
            height={36}
            priority
            style={{ width: "auto", height: "auto" }}
          />
        </Link>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-6 pb-10">
        <div className="w-full max-w-[480px]">
          <div className="bg-white/95 backdrop-blur p-8 rounded-[2rem] border border-white shadow-[0_24px_60px_-15px_rgba(124,58,237,0.25)]">
            <div className="text-center mb-7">
              <h1 className="text-3xl font-heading font-bold text-slate-900 leading-tight">
                Welcome back!
              </h1>
              <p className="text-slate-500 font-body mt-1.5">
                Pick up right where your learner left off.
              </p>
            </div>

            <div
              role="tablist"
              aria-label="Sign in method"
              className="flex p-1.5 bg-slate-100 rounded-2xl mb-7"
            >
              <button
                role="tab"
                aria-selected={mode === "email"}
                aria-controls="panel-email"
                id="tab-email"
                onClick={() => setMode("email")}
                style={{ minHeight: 44 }}
                className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  mode === "email"
                    ? "bg-white text-[hsl(var(--visual-primary))] shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Mail className="w-4 h-4" aria-hidden="true" />
                Email
              </button>
              <button
                role="tab"
                aria-selected={mode === "pin"}
                aria-controls="panel-pin"
                id="tab-pin"
                onClick={() => setMode("pin")}
                style={{ minHeight: 44 }}
                className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  mode === "pin"
                    ? "bg-gradient-to-r from-amber-300 to-amber-400 text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <KeyRound className="w-4 h-4" aria-hidden="true" />
                Learner PIN
              </button>
            </div>

            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="flex items-start gap-3 p-4 rounded-2xl bg-rose-50 border-2 border-rose-200 text-rose-700 text-sm font-bold mb-6"
              >
                <span className="w-8 h-8 rounded-xl bg-white text-rose-600 flex items-center justify-center shrink-0 shadow-sm">
                  <AlertCircle size={18} strokeWidth={2.5} aria-hidden="true" />
                </span>
                <span className="pt-1">{error}</span>
              </div>
            )}

            {info && (
              <div
                role="status"
                aria-live="polite"
                className="flex items-start gap-3 p-4 rounded-2xl bg-violet-50 border-2 border-violet-200 text-violet-800 text-sm font-bold mb-6"
              >
                <span className="w-8 h-8 rounded-xl bg-white text-[hsl(var(--visual-primary))] flex items-center justify-center shrink-0 shadow-sm">
                  <Info size={18} strokeWidth={2.5} aria-hidden="true" />
                </span>
                <span className="pt-1">{info}</span>
              </div>
            )}

            {mode === "email" ? (
              <div role="tabpanel" id="panel-email" aria-labelledby="tab-email">
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100 rounded-2xl p-4 flex items-center gap-4 mb-6">
                  <div className="bg-orange-100 p-2.5 rounded-xl text-orange-500 shrink-0">
                    <Flame className="w-6 h-6 fill-current" aria-hidden="true" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-orange-800">
                      {previewLearner.name} is on a {previewLearner.days}-day streak!
                    </p>
                    <p className="text-xs font-bold text-orange-600">{previewLearner.subtitle}</p>
                  </div>
                  <Image
                    src={`/images/tutors/${previewLearner.tutor}.png`}
                    alt=""
                    width={40}
                    height={40}
                    className={`rounded-xl ${previewLearner.avatarBg} object-contain`}
                  />
                </div>

                <form onSubmit={simulateSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label
                      htmlFor="login-email"
                      className="block text-sm font-bold text-slate-700 ml-1"
                    >
                      Email
                    </label>
                    <div className="relative">
                      <Mail
                        className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2"
                        aria-hidden="true"
                      />
                      <input
                        id="login-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        style={{ minHeight: 44 }}
                        className="w-full h-14 pl-12 pr-4 rounded-2xl bg-slate-50 border-2 border-slate-100 text-slate-900 font-body focus:bg-white focus:border-[hsl(var(--visual-primary))] focus:ring-4 focus:ring-[hsl(var(--visual-primary)/0.15)] outline-none transition"
                        placeholder="parent@example.com"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center ml-1">
                      <label
                        htmlFor="login-password"
                        className="block text-sm font-bold text-slate-700"
                      >
                        Password
                      </label>
                      <Link
                        href="/forgot-password"
                        className="text-sm font-bold text-[hsl(var(--visual-primary))] hover:underline"
                      >
                        Forgot?
                      </Link>
                    </div>
                    <div className="relative">
                      <Lock
                        className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2"
                        aria-hidden="true"
                      />
                      <input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        style={{ minHeight: 44 }}
                        className="w-full h-14 pl-12 pr-12 rounded-2xl bg-slate-50 border-2 border-slate-100 text-slate-900 font-body focus:bg-white focus:border-[hsl(var(--visual-primary))] focus:ring-4 focus:ring-[hsl(var(--visual-primary)/0.15)] outline-none transition"
                        placeholder="Enter your password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    aria-busy={loading}
                    style={{ minHeight: 44 }}
                    className="w-full h-14 mt-2 rounded-2xl bg-gradient-to-r from-[hsl(var(--visual-primary))] to-[hsl(var(--visual-primary-dark))] hover:opacity-95 text-white font-bold text-lg shadow-xl shadow-purple-200 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2
                          size={20}
                          strokeWidth={2.5}
                          className="motion-safe:animate-spin"
                          aria-hidden="true"
                        />
                        Signing in...
                      </>
                    ) : (
                      <>
                        Sign in
                        <ArrowRight className="w-5 h-5" aria-hidden="true" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            ) : (
              <div role="tabpanel" id="panel-pin" aria-labelledby="tab-pin" className="space-y-7">
                <div className="text-center">
                  <p className="font-bold text-slate-700 mb-4 text-sm">
                    Who&apos;s learning today?
                  </p>
                  <div className="flex justify-center gap-3">
                    {LEARNERS.map((l, idx) => (
                      <button
                        key={l.name}
                        type="button"
                        onClick={() => setSelectedLearner(idx)}
                        className={`flex flex-col items-center gap-1.5 transition-all ${
                          selectedLearner === idx ? "scale-110" : "opacity-70 hover:opacity-100"
                        }`}
                        aria-pressed={selectedLearner === idx}
                      >
                        <div
                          className={`w-16 h-16 rounded-2xl ${l.bg} border-4 ${
                            selectedLearner === idx ? l.border + " shadow-lg" : "border-transparent"
                          } flex items-center justify-center overflow-hidden`}
                        >
                          <Image
                            src={`/images/tutors/${l.tutor}.png`}
                            alt=""
                            width={48}
                            height={48}
                            className="object-contain"
                          />
                        </div>
                        <span
                          className={`text-xs font-bold ${selectedLearner === idx ? "text-slate-900" : "text-slate-500"}`}
                        >
                          {l.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="font-bold text-slate-700 mb-3 text-sm text-center">
                    What sounds fun?
                  </p>
                  <div className="flex justify-center gap-2 flex-wrap">
                    {SUBJECT_PILLS.map((s) => {
                      const active = activeSubject === s.key;
                      return (
                        <button
                          key={s.key}
                          type="button"
                          onClick={() => setActiveSubject(s.key)}
                          aria-pressed={active}
                          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-bold border-2 transition-all ${
                            active
                              ? `${s.bg} ${s.text} ${s.border} shadow-sm scale-105`
                              : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <s.Icon className="w-4 h-4" aria-hidden="true" />
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <form onSubmit={simulateSubmit} className="space-y-5">
                  <div>
                    <label
                      htmlFor="parent-id"
                      className="block text-sm font-bold text-slate-700 mb-2 ml-1"
                    >
                      Parent email or ID
                    </label>
                    <div className="relative">
                      <User
                        className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2"
                        aria-hidden="true"
                      />
                      <input
                        id="parent-id"
                        type="text"
                        value={parentId}
                        onChange={(e) => setParentId(e.target.value)}
                        required
                        autoComplete="username"
                        style={{ minHeight: 44 }}
                        className="w-full h-14 pl-12 pr-4 rounded-2xl bg-slate-50 border-2 border-slate-100 text-slate-900 font-body focus:bg-white focus:border-amber-400 focus:ring-4 focus:ring-amber-200/40 outline-none transition"
                        placeholder="parent@example.com"
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="learner-pin"
                      className="block text-sm font-bold text-slate-700 mb-2 ml-1 text-center"
                    >
                      Enter your secret PIN
                    </label>
                    <input
                      id="learner-pin"
                      type="password"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      required
                      maxLength={6}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      style={{ minHeight: 44 }}
                      className="w-full h-14 px-4 rounded-2xl bg-slate-50 border-2 border-slate-100 text-slate-900 font-heading font-bold text-3xl text-center tracking-[0.6em] focus:bg-white focus:border-amber-400 focus:ring-4 focus:ring-amber-200/40 outline-none transition"
                      placeholder="••••••"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    aria-busy={loading}
                    style={{ minHeight: 44 }}
                    className="w-full h-14 rounded-2xl bg-gradient-to-r from-amber-300 to-amber-400 hover:opacity-95 text-slate-900 font-bold text-lg shadow-xl shadow-amber-100 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2
                          size={20}
                          strokeWidth={2.5}
                          className="motion-safe:animate-spin"
                          aria-hidden="true"
                        />
                        Signing in...
                      </>
                    ) : (
                      <>
                        Let&apos;s Go!
                        <ArrowRight className="w-5 h-5" aria-hidden="true" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>

          <div className="text-center mt-7">
            <div className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 bg-white/70 backdrop-blur px-4 py-2 rounded-full border border-slate-200">
              <ShieldCheck
                className="w-4 h-4 text-[hsl(var(--visual-primary))]"
                aria-hidden="true"
              />
              Designed to support COPPA · FERPA · SOC 2
            </div>
            <p className="text-sm font-medium text-slate-500 mt-5">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="text-[hsl(var(--visual-primary))] font-bold hover:underline"
              >
                Start free trial
              </Link>
            </p>
          </div>
        </div>
      </main>

      <footer className="relative z-10 flex items-center justify-center gap-6 pb-6 text-xs text-slate-500 font-body font-semibold">
        <Link href="/privacy-policy" className="hover:text-[hsl(var(--visual-primary))] transition">
          Privacy
        </Link>
        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
        <Link
          href="/terms-of-service"
          className="hover:text-[hsl(var(--visual-primary))] transition"
        >
          Terms
        </Link>
        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
        <Link
          href="/coppa-compliance"
          className="hover:text-[hsl(var(--visual-primary))] transition"
        >
          COPPA
        </Link>
      </footer>
    </div>
  );
}
