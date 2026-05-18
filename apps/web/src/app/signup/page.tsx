"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useRouter, useSearchParams } from "next/navigation";
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
  Loader2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Brain,
  Users,
  Zap,
  Tag,
  ChevronDown,
  ChevronUp,
  XCircle,
} from "lucide-react";

function SignupInner() {
  const { register } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const invitedEmail = params.get("email") || "";
  const t = useTranslations("auth");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(invitedEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [couponCode, setCouponCode] = useState(params.get("coupon") || "");
  const [couponExpanded, setCouponExpanded] = useState(!!params.get("coupon"));
  const [couponState, setCouponState] = useState<null | {
    valid: boolean;
    couponType?: string;
    discountPct?: number;
    grantsPlan?: string;
    grantsTier?: string;
    description?: string | null;
    reason?: string;
  }>(null);
  const [couponChecking, setCouponChecking] = useState(false);
  const couponDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (invitedEmail && !email) setEmail(invitedEmail);
  }, [invitedEmail]);

  useEffect(() => {
    if (!couponCode) {
      setCouponState(null);
      return;
    }
    if (couponCode.length < 3) {
      setCouponState(null);
      return;
    }
    if (couponDebounceRef.current) clearTimeout(couponDebounceRef.current);
    couponDebounceRef.current = setTimeout(async () => {
      setCouponChecking(true);
      try {
        const res = await fetch("/api/billing/coupons/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: couponCode }),
        });
        const data = await res.json();
        setCouponState(data);
      } catch {
        setCouponState({ valid: false, reason: "network_error" });
      } finally {
        setCouponChecking(false);
      }
    }, 400);
    return () => {
      if (couponDebounceRef.current) clearTimeout(couponDebounceRef.current);
    };
  }, [couponCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(email, password, name, "PARENT");
      // Store validated coupon for post-registration redemption
      if (couponState?.valid && couponCode) {
        try {
          sessionStorage.setItem("pending_coupon", couponCode);
          if (couponState.couponType === "PROVISIONING") {
            sessionStorage.setItem("pending_coupon_type", "PROVISIONING");
          }
        } catch {}
      }
      if (invitedEmail) {
        router.push(`/accept-invite?email=${encodeURIComponent(invitedEmail)}`);
      } else {
        router.push("/");
      }
    } catch (err: any) {
      setError(err.message || t("register_failed"));
    }
    setLoading(false);
  };

  const VALUE_PROPS = [
    {
      Icon: Brain,
      key: "signup_feature_brain_clone" as const,
      color: "text-violet-600",
      bg: "bg-violet-100",
    },
    {
      Icon: Users,
      key: "signup_feature_tutors" as const,
      color: "text-cyan-600",
      bg: "bg-cyan-100",
    },
    {
      Icon: Zap,
      key: "signup_feature_levels" as const,
      color: "text-amber-600",
      bg: "bg-amber-100",
    },
    {
      Icon: ShieldCheck,
      key: "signup_feature_coppa" as const,
      color: "text-emerald-600",
      bg: "bg-emerald-100",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-100 via-white to-amber-50 flex flex-col relative overflow-hidden">
      <SkipLink />

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
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-100 text-violet-700 font-bold text-xs uppercase tracking-wider mb-3">
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                {t("start_free_today") ?? "Start free today"}
              </span>
              <h1 className="text-3xl font-heading font-bold text-slate-900 leading-tight">
                {t("create_account")}
              </h1>
              <p className="text-slate-500 font-body mt-1.5">{t("signup_subtitle")}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-7">
              {VALUE_PROPS.map(({ Icon, key, color, bg }) => (
                <div
                  key={key}
                  className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-slate-50 border border-slate-100"
                >
                  <div
                    className={`w-9 h-9 rounded-xl ${bg} ${color} flex items-center justify-center shrink-0`}
                  >
                    <Icon className="w-4.5 h-4.5" size={18} strokeWidth={2.5} aria-hidden="true" />
                  </div>
                  <p className="text-xs font-bold text-slate-700 leading-snug">{t(key)}</p>
                </div>
              ))}
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

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label
                  htmlFor="signup-name"
                  className="block text-sm font-bold text-slate-700 ml-1"
                >
                  {t("full_name")}
                </label>
                <div className="relative">
                  <User
                    className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <input
                    id="signup-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoComplete="name"
                    style={{ minHeight: 44 }}
                    className="w-full h-14 pl-12 pr-4 rounded-2xl bg-slate-50 border-2 border-slate-100 text-slate-900 font-body focus:bg-white focus:border-[hsl(var(--visual-primary))] focus:ring-4 focus:ring-[hsl(var(--visual-primary)/0.15)] outline-none transition"
                    placeholder={t("name_placeholder")}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="signup-email"
                  className="block text-sm font-bold text-slate-700 ml-1"
                >
                  {t("email")}
                </label>
                <div className="relative">
                  <Mail
                    className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <input
                    id="signup-email"
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
                <label
                  htmlFor="signup-password"
                  className="block text-sm font-bold text-slate-700 ml-1"
                >
                  {t("password")}
                </label>
                <div className="relative">
                  <Lock
                    className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <input
                    id="signup-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    style={{ minHeight: 44 }}
                    className="w-full h-14 pl-12 pr-12 rounded-2xl bg-slate-50 border-2 border-slate-100 text-slate-900 font-body focus:bg-white focus:border-[hsl(var(--visual-primary))] focus:ring-4 focus:ring-[hsl(var(--visual-primary)/0.15)] outline-none transition"
                    placeholder={t("password_min_placeholder")}
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
                <p className="text-xs text-slate-500 font-body mt-1.5 ml-1">{t("password_hint")}</p>
              </div>

              {/* Coupon / Access Code */}
              <div>
                <button
                  type="button"
                  onClick={() => setCouponExpanded((v) => !v)}
                  className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[hsl(var(--visual-primary))] transition"
                >
                  <Tag className="w-4 h-4" aria-hidden="true" />
                  {t("coupon_toggle")}
                  {couponExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>

                {couponExpanded && (
                  <div className="mt-3 space-y-2">
                    <div className="relative">
                      <Tag
                        className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2"
                        aria-hidden="true"
                      />
                      <input
                        id="signup-coupon"
                        type="text"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        autoCapitalize="characters"
                        autoComplete="off"
                        style={{ minHeight: 44 }}
                        className="w-full h-14 pl-12 pr-12 rounded-2xl bg-slate-50 border-2 border-slate-100 text-slate-900 font-body focus:bg-white focus:border-[hsl(var(--visual-primary))] focus:ring-4 focus:ring-[hsl(var(--visual-primary)/0.15)] outline-none transition uppercase tracking-widest"
                        placeholder={t("coupon_placeholder")}
                      />
                      {couponChecking && (
                        <Loader2
                          className="w-5 h-5 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 motion-safe:animate-spin"
                          aria-hidden="true"
                        />
                      )}
                    </div>

                    {couponState &&
                      !couponChecking &&
                      (couponState.valid ? (
                        <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-bold">
                          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                          <span>
                            {couponCode}
                            {couponState.description ? ` — ${couponState.description}` : ""}
                            {couponState.couponType === "DISCOUNT" && couponState.discountPct
                              ? ` — ${couponState.discountPct}% off your subscription`
                              : ""}
                            {couponState.couponType === "PROVISIONING" && !couponState.description
                              ? ` — ${t("coupon_valid_provisioning")}`
                              : ""}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold">
                          <XCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                          <span>
                            {couponState.reason === "not_found" && t("coupon_invalid_not_found")}
                            {couponState.reason === "expired" && t("coupon_invalid_expired")}
                            {couponState.reason === "exhausted" && t("coupon_invalid_exhausted")}
                            {couponState.reason === "inactive" && t("coupon_invalid_inactive")}
                            {couponState.reason === "network_error" &&
                              t("coupon_invalid_network_error")}
                            {![
                              "not_found",
                              "expired",
                              "exhausted",
                              "inactive",
                              "network_error",
                            ].includes(couponState.reason ?? "") && t("coupon_invalid_generic")}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
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
                    <Loader2
                      size={20}
                      strokeWidth={2.5}
                      className="motion-safe:animate-spin"
                      aria-hidden="true"
                    />
                    {t("signing_up")}
                  </>
                ) : (
                  <>
                    {t("create_account")}
                    <ArrowRight className="w-5 h-5" aria-hidden="true" />
                  </>
                )}
              </button>
            </form>

            <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                {t("signup_free_trial")}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                {t("signup_no_credit_card")}
              </span>
            </div>

            <p className="text-xs text-slate-500 text-center mt-4 font-body leading-relaxed">
              {t("agree_terms_prefix")}{" "}
              <Link
                href="/terms-of-service"
                className="text-[hsl(var(--visual-primary))] hover:underline font-bold"
              >
                {t("terms")}
              </Link>{" "}
              {t("and")}{" "}
              <Link
                href="/privacy-policy"
                className="text-[hsl(var(--visual-primary))] hover:underline font-bold"
              >
                {t("privacy")}
              </Link>
            </p>
          </div>

          <div className="text-center mt-7">
            <div className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 bg-white/70 backdrop-blur px-4 py-2 rounded-full border border-slate-200">
              <ShieldCheck
                className="w-4 h-4 text-[hsl(var(--visual-primary))]"
                aria-hidden="true"
              />
              {t("compliance_badge") ?? "COPPA · FERPA · SOC 2 Compliant"}
            </div>
            <p className="text-sm font-medium text-slate-500 mt-5">
              {t("have_account")}{" "}
              <Link
                href="/login"
                className="text-[hsl(var(--visual-primary))] font-bold hover:underline"
              >
                {t("sign_in")}
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
        <Link
          href="/terms-of-service"
          className="hover:text-[hsl(var(--visual-primary))] transition"
        >
          {t("terms")}
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

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupInner />
    </Suspense>
  );
}
