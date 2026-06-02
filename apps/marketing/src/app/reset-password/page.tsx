"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Loader2,
} from "lucide-react";

const STRENGTH_COLORS = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-lime-500",
  "bg-emerald-500",
];
const STRENGTH_LABELS = ["Very weak", "Weak", "Fair", "Strong", "Very strong"];

interface PolicyCheck {
  ok: boolean;
  reasons: string[];
  strengthScore: number;
}

function ResetPasswordInner() {
  const t = useTranslations("marketing.page_reset_password");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [policy, setPolicy] = useState<PolicyCheck | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!password) {
      setPolicy(null);
      return;
    }
    const handle = setTimeout(() => {
      setChecking(true);
      const len = password.length;
      let score = 0;
      const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z0-9]/].filter((re) =>
        re.test(password),
      ).length;
      let entropy = Math.min(len, 32) * 2 + classes * 6;
      if (/(.)\1{2,}/.test(password)) entropy -= 8;
      if (entropy < 18) score = 0;
      else if (entropy < 30) score = 1;
      else if (entropy < 42) score = 2;
      else if (entropy < 56) score = 3;
      else score = 4;
      const reasons: string[] = [];
      if (len < 12) reasons.push("Too short — at least 12 characters required");
      if (score < 3) reasons.push("Not strong enough — add more length or variety");
      setPolicy({ ok: reasons.length === 0, reasons, strengthScore: score });
      setChecking(false);
    }, 200);
    return () => clearTimeout(handle);
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 700));
    setLoading(false);
    setSuccess(true);
  };

  const score = policy?.strengthScore ?? 0;
  const submitDisabled = loading || password.length < 12 || password !== confirm;

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-100 via-white to-amber-50 flex flex-col relative overflow-hidden">
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none -z-0">
        <div className="absolute -top-20 -left-20 w-[45vw] h-[45vw] bg-violet-300/40 rounded-full blur-3xl animate-blob motion-reduce:animate-none" />
        <div
          className="absolute -bottom-20 -right-20 w-[40vw] h-[40vw] bg-amber-200/50 rounded-full blur-3xl animate-blob motion-reduce:animate-none"
          style={{ animationDelay: "5s" }}
        />
      </div>

      <header className="relative z-30 flex items-center justify-between p-6">
        <Link href="/" aria-label={t("logo_aria")}>
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
            <div className="w-14 h-14 rounded-2xl bg-violet-100 text-[hsl(var(--visual-primary))] flex items-center justify-center mx-auto mb-4">
              <Lock size={28} strokeWidth={2.5} aria-hidden="true" />
            </div>
            <h1 className="text-3xl font-heading font-bold text-slate-900 text-center leading-tight">
              {t("heading")}
            </h1>
            <p className="text-slate-500 font-body text-center mt-2">{t("subheading")}</p>

            {success ? (
              <div className="mt-7 text-center">
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 size={24} strokeWidth={2.5} aria-hidden="true" />
                  </div>
                  <p className="text-emerald-800 font-bold">{t("success_heading")}</p>
                  <p className="text-sm text-emerald-700 mt-1 font-body">
                    You&apos;d be redirected to sign in next. (Demo preview — no real reset
                    performed.)
                  </p>
                </div>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 mt-6 text-sm font-bold text-[hsl(var(--visual-primary))] hover:underline"
                >
                  <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                  {t("back_to_sign_in")}
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-7 space-y-5">
                <div className="space-y-2">
                  <label
                    htmlFor="reset-password-new"
                    className="block text-sm font-bold text-slate-700 ml-1"
                  >
                    {t("label_new_password")}
                  </label>
                  <div className="relative">
                    <Lock
                      className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2"
                      aria-hidden="true"
                    />
                    <input
                      id="reset-password-new"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={12}
                      autoComplete="new-password"
                      placeholder={t("placeholder_new_password")}
                      style={{ minHeight: 44 }}
                      className="w-full h-14 pl-12 pr-12 rounded-2xl bg-slate-50 border-2 border-slate-100 text-slate-900 font-body focus:bg-white focus:border-[hsl(var(--visual-primary))] focus:ring-4 focus:ring-[hsl(var(--visual-primary)/0.15)] outline-none transition"
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
                  {password && (
                    <div className="mt-3 space-y-2">
                      <div className="flex gap-1">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className={`h-1.5 flex-1 rounded-full ${i <= score ? STRENGTH_COLORS[score] : "bg-slate-200"}`}
                          />
                        ))}
                      </div>
                      <p
                        className={`text-xs font-bold ${score >= 3 ? "text-emerald-600" : "text-slate-500"}`}
                      >
                        {checking ? "Checking..." : STRENGTH_LABELS[score]}
                      </p>
                      {policy && policy.reasons.length > 0 && (
                        <ul className="text-xs text-slate-500 list-disc pl-4 space-y-0.5 font-body">
                          {policy.reasons.map((r) => (
                            <li key={r}>{r}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="reset-password-confirm"
                    className="block text-sm font-bold text-slate-700 ml-1"
                  >
                    {t("label_confirm_password")}
                  </label>
                  <div className="relative">
                    <Lock
                      className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2"
                      aria-hidden="true"
                    />
                    <input
                      id="reset-password-confirm"
                      type={showPassword ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      minLength={12}
                      autoComplete="new-password"
                      placeholder={t("placeholder_confirm_password")}
                      style={{ minHeight: 44 }}
                      className="w-full h-14 pl-12 pr-4 rounded-2xl bg-slate-50 border-2 border-slate-100 text-slate-900 font-body focus:bg-white focus:border-[hsl(var(--visual-primary))] focus:ring-4 focus:ring-[hsl(var(--visual-primary)/0.15)] outline-none transition"
                    />
                  </div>
                  {confirm && confirm !== password && (
                    <p className="text-xs text-rose-600 font-bold ml-1">
                      {t("passwords_mismatch")}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submitDisabled}
                  aria-busy={loading}
                  style={{ minHeight: 44 }}
                  className="w-full h-14 rounded-2xl bg-gradient-to-r from-[hsl(var(--visual-primary))] to-[hsl(var(--visual-primary-dark))] hover:opacity-95 text-white font-bold text-lg shadow-xl shadow-purple-200 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2
                        size={20}
                        strokeWidth={2.5}
                        className="motion-safe:animate-spin"
                        aria-hidden="true"
                      />
                      {t("btn_updating")}
                    </>
                  ) : (
                    <>
                      {t("btn_submit")}
                      <ArrowRight className="w-5 h-5" aria-hidden="true" />
                    </>
                  )}
                </button>

                <div className="text-center pt-2">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[hsl(var(--visual-primary))] transition"
                  >
                    <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                    {t("back_to_sign_in")}
                  </Link>
                </div>
              </form>
            )}
          </div>

          <div className="text-center mt-7">
            <div className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 bg-white/70 backdrop-blur px-4 py-2 rounded-full border border-slate-200">
              <ShieldCheck
                className="w-4 h-4 text-[hsl(var(--visual-primary))]"
                aria-hidden="true"
              />
              {t("trust_badge")}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function LoadingFallback() {
  const t = useTranslations("marketing.page_reset_password");
  return (
    <div className="min-h-screen flex items-center justify-center text-slate-400">
      {t("loading")}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ResetPasswordInner />
    </Suspense>
  );
}
