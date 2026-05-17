"use client";
import { useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SkipLink } from "@/components/a11y/SkipLink";
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
} from "lucide-react";

export default function LoginPage() {
  const { login, pinLogin } = useAuth();
  const router = useRouter();
  const t = useTranslations("auth");
  const [mode, setMode] = useState<"email" | "pin">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [parentId, setParentId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setRedirectTo(null);
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result?.mfaPending) {
        router.push(`/verify-mfa?token=${encodeURIComponent(result.mfaToken)}&method=${encodeURIComponent(result.mfaMethod || "email")}&returnTo=/`);
        return;
      }
      const roleDashboards: Record<string, string> = {
        PARENT: "/dashboard/parent",
        LEARNER: "/dashboard/learner",
        TEACHER: "/dashboard/teacher",
        CAREGIVER: "/dashboard/caregiver",
        THERAPIST: "/dashboard/therapist",
      };
      const dest = roleDashboards[result?.user?.role] || "/dashboard/parent";
      router.replace(dest);
    } catch (err: any) {
      setError(err.message || t("login_failed"));
      if (err && typeof err === "object" && err.redirectTo) {
        setRedirectTo(err.redirectTo as string);
      }
    }
    setLoading(false);
  };

  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await pinLogin(parentId, pin);
      router.push("/dashboard/learner/assessment");
    } catch (err: any) {
      setError(err.message || t("pin_login_failed"));
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-100 via-white to-amber-50 flex flex-col relative overflow-hidden">
      <SkipLink />

      <div aria-hidden="true" className="absolute inset-0 pointer-events-none -z-0">
        <div className="absolute -top-20 -left-20 w-[45vw] h-[45vw] bg-violet-300/40 rounded-full blur-3xl animate-blob motion-reduce:animate-none" />
        <div className="absolute -bottom-20 -right-20 w-[40vw] h-[40vw] bg-amber-200/50 rounded-full blur-3xl animate-blob motion-reduce:animate-none" style={{ animationDelay: "5s" }} />
        <div className="absolute top-1/3 right-10 w-64 h-64 bg-cyan-200/40 rounded-full blur-3xl animate-blob motion-reduce:animate-none" style={{ animationDelay: "2s" }} />
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
        <LanguageSwitcher compact />
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="relative z-10 flex-1 flex items-center justify-center px-6 pb-10"
      >
        <div className="w-full max-w-[480px]">
          <div className="bg-white/95 backdrop-blur p-8 rounded-[2rem] border border-white shadow-[0_24px_60px_-15px_rgba(124,58,237,0.25)]">
            <div className="text-center mb-7">
              <h1 className="text-3xl font-heading font-bold text-slate-900 leading-tight">
                {t("welcome_back")}!
              </h1>
              <p className="text-slate-500 font-body mt-1.5">
                {t("continue_description")}
              </p>
            </div>

            <div
              role="tablist"
              aria-label={t("login_method_label") ?? "Sign in method"}
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
                {t("email_login")}
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
                {t("learner_pin")}
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
                <span className="pt-1">
                  {error}
                  {redirectTo && (
                    <>
                      {" "}
                      <Link href={redirectTo} className="underline font-black">
                        {t("go_to_staff_signin") ?? "Go to staff sign-in"}
                      </Link>
                    </>
                  )}
                </span>
              </div>
            )}

            {mode === "email" ? (
              <div role="tabpanel" id="panel-email" aria-labelledby="tab-email">
                <form onSubmit={handleEmailLogin} className="space-y-5">
                  <div className="space-y-2">
                    <label htmlFor="login-email" className="block text-sm font-bold text-slate-700 ml-1">
                      {t("email")}
                    </label>
                    <div className="relative">
                      <Mail className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" aria-hidden="true" />
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
                      <label htmlFor="login-password" className="block text-sm font-bold text-slate-700">
                        {t("password")}
                      </label>
                      <Link
                        href="/forgot-password"
                        className="text-sm font-bold text-[hsl(var(--visual-primary))] hover:underline"
                      >
                        {t("forgot_password") ?? "Forgot?"}
                      </Link>
                    </div>
                    <div className="relative">
                      <Lock className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" aria-hidden="true" />
                      <input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        style={{ minHeight: 44 }}
                        className="w-full h-14 pl-12 pr-12 rounded-2xl bg-slate-50 border-2 border-slate-100 text-slate-900 font-body focus:bg-white focus:border-[hsl(var(--visual-primary))] focus:ring-4 focus:ring-[hsl(var(--visual-primary)/0.15)] outline-none transition"
                        placeholder={t("enter_password") ?? "Enter your password"}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    aria-busy={loading}
                    style={{ minHeight: 44 }}
                    className="w-full h-14 mt-2 rounded-2xl bg-gradient-to-r from-[hsl(var(--visual-primary))] to-[hsl(var(--visual-primary-dark,262_83%_46%))] hover:opacity-95 text-white font-bold text-lg shadow-xl shadow-purple-200 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={20} strokeWidth={2.5} className="motion-safe:animate-spin" aria-hidden="true" />
                        {t("signing_in")}
                      </>
                    ) : (
                      <>
                        {t("sign_in")}
                        <ArrowRight className="w-5 h-5" aria-hidden="true" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            ) : (
              <div role="tabpanel" id="panel-pin" aria-labelledby="tab-pin" className="space-y-7">
                <form onSubmit={handlePinLogin} className="space-y-5">
                  <div>
                    <label htmlFor="parent-id" className="block text-sm font-bold text-slate-700 mb-2 ml-1">
                      {t("parent_email_or_id")}
                    </label>
                    <div className="relative">
                      <User className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" aria-hidden="true" />
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
                    <label htmlFor="learner-pin" className="block text-sm font-bold text-slate-700 mb-2 ml-1 text-center">
                      {t("enter_secret_pin") ?? "Enter your secret PIN"}
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
                        <Loader2 size={20} strokeWidth={2.5} className="motion-safe:animate-spin" aria-hidden="true" />
                        {t("signing_in")}
                      </>
                    ) : (
                      <>
                        {t("lets_go") ?? "Let's Go!"}
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
              <ShieldCheck className="w-4 h-4 text-[hsl(var(--visual-primary))]" aria-hidden="true" />
              {t("compliance_badge") ?? "COPPA · FERPA · SOC 2 Compliant"}
            </div>
            <p className="text-sm font-medium text-slate-500 mt-5">
              {t("no_account")}{" "}
              <Link href="/signup" className="text-[hsl(var(--visual-primary))] font-bold hover:underline">
                {t("start_free_trial") ?? t("sign_up")}
              </Link>
            </p>
          </div>
        </div>
      </main>

      <footer className="relative z-10 flex items-center justify-center gap-6 pb-6 text-xs text-slate-500 font-body font-semibold">
        <Link href="/privacy-policy" className="hover:text-[hsl(var(--visual-primary))] transition">
          {t("privacy")}
        </Link>
        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
        <Link href="/terms-of-service" className="hover:text-[hsl(var(--visual-primary))] transition">
          {t("terms")}
        </Link>
        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
        <Link href="/coppa-compliance" className="hover:text-[hsl(var(--visual-primary))] transition">
          COPPA
        </Link>
      </footer>
    </div>
  );
}
