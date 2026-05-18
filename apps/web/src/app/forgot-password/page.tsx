"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Mail, ArrowLeft, ArrowRight, ShieldCheck, Loader2, AlertCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not send reset link");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

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
            <div className="w-14 h-14 rounded-2xl bg-violet-100 text-[hsl(var(--visual-primary))] flex items-center justify-center mx-auto mb-4">
              <Mail size={28} strokeWidth={2.5} aria-hidden="true" />
            </div>
            <h1 className="text-3xl font-heading font-bold text-slate-900 text-center leading-tight">
              Forgot password?
            </h1>
            <p className="text-slate-500 font-body text-center mt-2">
              Enter your email and we&apos;ll send you a link to reset your password.
            </p>

            {submitted ? (
              <div className="mt-7 text-center">
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5">
                  <p className="text-emerald-800 font-bold">Check your inbox</p>
                  <p className="text-sm text-emerald-700 mt-2 font-body">
                    If an account exists for <strong>{email}</strong>, a reset link is on its way.
                    The link expires in 1 hour.
                  </p>
                </div>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 mt-6 text-sm font-bold text-[hsl(var(--visual-primary))] hover:underline"
                >
                  <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                  Back to sign in
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-7 space-y-5">
                <div className="space-y-2">
                  <label
                    htmlFor="forgot-email"
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
                      id="forgot-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      placeholder="parent@example.com"
                      style={{ minHeight: 44 }}
                      className="w-full h-14 pl-12 pr-4 rounded-2xl bg-slate-50 border-2 border-slate-100 text-slate-900 font-body focus:bg-white focus:border-[hsl(var(--visual-primary))] focus:ring-4 focus:ring-[hsl(var(--visual-primary)/0.15)] outline-none transition"
                    />
                  </div>
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
                  disabled={loading}
                  aria-busy={loading}
                  style={{ minHeight: 44 }}
                  className="w-full h-14 rounded-2xl bg-gradient-to-r from-[hsl(var(--visual-primary))] to-[hsl(var(--visual-primary-dark,262_83%_46%))] hover:opacity-95 text-white font-bold text-lg shadow-xl shadow-purple-200 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2
                        size={20}
                        strokeWidth={2.5}
                        className="motion-safe:animate-spin"
                        aria-hidden="true"
                      />
                      Sending...
                    </>
                  ) : (
                    <>
                      Send reset link
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
                    Back to sign in
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
              COPPA · FERPA · SOC 2 Compliant
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
