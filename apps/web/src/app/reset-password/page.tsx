"use client";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Loader2,
  AlertCircle,
} from "lucide-react";

const STRENGTH_COLORS = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-lime-500",
  "bg-emerald-500",
];
const STRENGTH_LABELS = ["Very weak", "Weak", "Fair", "Strong", "Very strong"];

function reasonText(r: string): string {
  switch (r) {
    case "too_short":
      return "Too short — at least 12 characters required";
    case "too_weak":
      return "Not strong enough — add more length or variety";
    case "breached":
      return "This password has appeared in a public breach";
    case "reused":
      return "You've used this password before — pick a new one";
    case "missing_diversity":
      return "Use at least 3 of: lowercase, uppercase, digits, symbols";
    default:
      return r;
  }
}

interface PolicyCheck {
  ok: boolean;
  reasons: string[];
  strengthScore: number;
}

function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [policy, setPolicy] = useState<PolicyCheck | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!token) setError("Missing reset token. Please request a new reset link.");
  }, [token]);

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
      if (len < 12) reasons.push("too_short");
      if (score < 3) reasons.push("too_weak");
      setPolicy({ ok: reasons.length === 0, reasons, strengthScore: score });
      setChecking(false);
    }, 200);
    return () => clearTimeout(handle);
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (Array.isArray(data.reasons) && data.reasons.length) {
          throw new Error(data.reasons.map(reasonText).join(" • "));
        }
        throw new Error(data.error || "Could not reset password");
      }
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const score = policy?.strengthScore ?? 0;
  const submitDisabled = loading || !token || password.length < 12 || password !== confirm;

  return (
    <div className="min-h-screen bg-gradient-to-br from-iw-bg via-iw-raised to-iw-warm-soft flex flex-col relative overflow-hidden">
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none -z-0">
        <div className="absolute -top-20 -left-20 w-[45vw] h-[45vw] bg-iw-primary/20 rounded-full blur-3xl animate-blob motion-reduce:animate-none" />
        <div
          className="absolute -bottom-20 -right-20 w-[40vw] h-[40vw] bg-iw-warm/40 rounded-full blur-3xl animate-blob motion-reduce:animate-none"
          style={{ animationDelay: "5s" }}
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
          <div className="bg-iw-card/95 backdrop-blur p-8 rounded-[2rem] border border-iw-raised shadow-soft-5">
            <div className="w-14 h-14 rounded-2xl bg-iw-primary/10 text-iw-primary flex items-center justify-center mx-auto mb-4">
              <Lock size={28} strokeWidth={2.5} aria-hidden="true" />
            </div>
            <h1 className="text-3xl font-heading font-bold text-iw-ink text-center leading-tight">
              Reset your password
            </h1>
            <p className="text-iw-ink-muted font-body text-center mt-2">
              Choose a new password for your account.
            </p>

            {success ? (
              <div className="mt-7 text-center">
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 size={24} strokeWidth={2.5} aria-hidden="true" />
                  </div>
                  <p className="text-emerald-800 font-bold">Password updated</p>
                  <p className="text-sm text-emerald-700 mt-1 font-body">
                    Redirecting you to sign in...
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-7 space-y-5">
                <div className="space-y-2">
                  <label
                    htmlFor="reset-password-new"
                    className="block text-sm font-bold text-iw-ink ml-1"
                  >
                    New password
                  </label>
                  <div className="relative">
                    <Lock
                      className="w-5 h-5 text-iw-ink-muted absolute left-4 top-1/2 -translate-y-1/2"
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
                      placeholder="At least 12 characters"
                      style={{ minHeight: 44 }}
                      className="w-full h-14 pl-12 pr-12 rounded-2xl bg-iw-bg border-2 border-iw-border text-iw-ink font-body focus:bg-iw-raised focus:border-iw-primary focus:ring-4 focus:ring-iw-ring/30 outline-none transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-iw-ink-muted hover:text-iw-ink"
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
                            className={`h-1.5 flex-1 rounded-full ${i <= score ? STRENGTH_COLORS[score] : "bg-iw-border"}`}
                          />
                        ))}
                      </div>
                      <p
                        className={`text-xs font-bold ${score >= 3 ? "text-emerald-600" : "text-iw-ink-muted"}`}
                      >
                        {checking ? "Checking..." : STRENGTH_LABELS[score]}
                      </p>
                      {policy && policy.reasons.length > 0 && (
                        <ul className="text-xs text-iw-ink-muted list-disc pl-4 space-y-0.5 font-body">
                          {policy.reasons.map((r) => (
                            <li key={r}>{reasonText(r)}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="reset-password-confirm"
                    className="block text-sm font-bold text-iw-ink ml-1"
                  >
                    Confirm new password
                  </label>
                  <div className="relative">
                    <Lock
                      className="w-5 h-5 text-iw-ink-muted absolute left-4 top-1/2 -translate-y-1/2"
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
                      placeholder="Re-enter your new password"
                      style={{ minHeight: 44 }}
                      className="w-full h-14 pl-12 pr-4 rounded-2xl bg-iw-bg border-2 border-iw-border text-iw-ink font-body focus:bg-iw-raised focus:border-iw-primary focus:ring-4 focus:ring-iw-ring/30 outline-none transition"
                    />
                  </div>
                  {confirm && confirm !== password && (
                    <p className="text-xs text-rose-600 font-bold ml-1">
                      Passwords don&apos;t match yet
                    </p>
                  )}
                </div>

                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-3 p-4 rounded-2xl bg-rose-50 border-2 border-rose-200 text-rose-700 text-sm font-bold"
                  >
                    <AlertCircle
                      size={18}
                      strokeWidth={2.5}
                      className="shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitDisabled}
                  aria-busy={loading}
                  style={{ minHeight: 44 }}
                  className="w-full h-14 rounded-2xl bg-iw-primary hover:bg-iw-primary-hover text-iw-primary-fg font-bold text-lg shadow-soft-5 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2
                        size={20}
                        strokeWidth={2.5}
                        className="motion-safe:animate-spin"
                        aria-hidden="true"
                      />
                      Updating...
                    </>
                  ) : (
                    <>
                      Update password
                      <ArrowRight className="w-5 h-5" aria-hidden="true" />
                    </>
                  )}
                </button>

                <div className="text-center pt-2">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 text-sm font-bold text-iw-ink-muted hover:text-iw-primary transition"
                  >
                    <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                    Back to sign in
                  </Link>
                </div>
              </form>
            )}
          </div>

          <div className="text-center mt-7">
            <div className="inline-flex items-center gap-2 text-sm font-bold text-iw-ink-muted bg-iw-raised/70 backdrop-blur px-4 py-2 rounded-full border border-iw-border">
              <ShieldCheck className="w-4 h-4 text-iw-primary" aria-hidden="true" />
              COPPA · FERPA · SOC 2 Compliant
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-iw-ink-muted">
          Loading...
        </div>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}
