/**
 * Sprint 7: forced password change page.
 *
 * Reached via auth-provider redirect when /api/auth/refresh returns
 * `mustChangePassword: true` (either the user was flagged on creation
 * with `must_change_password`, or rotation is past due for an internal
 * role). The page collects current + new password, posts to
 * /api/auth/password, and bounces back to the surface dashboard.
 */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";

const STRENGTH_COLORS = ["bg-red-500", "bg-orange-500", "bg-amber-500", "bg-lime-500", "bg-emerald-500"];
const STRENGTH_LABELS = ["Very weak", "Weak", "Fair", "Strong", "Very strong"];

function reasonText(r: string): string {
  switch (r) {
    case "too_short": return "Too short — at least 12 characters required (14 for staff)";
    case "too_weak": return "Not strong enough — add more length or variety";
    case "breached": return "This password has appeared in a public breach";
    case "reused": return "You've used this password before";
    case "missing_diversity": return "Use at least 3 of: lowercase, uppercase, digits, symbols";
    default: return r;
  }
}

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, accessToken, refreshToken } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState(0);
  const [reasons, setReasons] = useState<string[]>([]);

  useEffect(() => {
    if (!next) { setScore(0); setReasons([]); return; }
    const len = next.length;
    const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z0-9]/].filter((re) => re.test(next)).length;
    let entropy = Math.min(len, 32) * 2 + classes * 6;
    if (/(.)\1{2,}/.test(next)) entropy -= 8;
    let s = 0;
    if (entropy >= 18) s = 1;
    if (entropy >= 30) s = 2;
    if (entropy >= 42) s = 3;
    if (entropy >= 56) s = 4;
    setScore(s);
    const r: string[] = [];
    if (len < 12) r.push("too_short");
    if (s < 3) r.push("too_weak");
    setReasons(r);
  }, [next]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next !== confirm) { setError("New passwords don't match"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (Array.isArray(data.reasons) && data.reasons.length) {
          throw new Error(data.reasons.map(reasonText).join(" • "));
        }
        throw new Error(data.error || "Could not update password");
      }
      // Server invalidated all sessions — re-login by hitting refresh, then
      // route back to the right surface.
      await refreshToken().catch(() => {});
      const dest = user?.role === "DISTRICT_ADMIN" ? "/dashboard/district"
        : user?.role === "PLATFORM_ADMIN" ? "/dashboard/admin"
        : "/dashboard";
      router.push(dest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-violet-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">!</div>
          <h1 className="text-2xl font-heading font-bold text-slate-900">Update your password</h1>
        </div>
        <p className="text-sm text-slate-500 mb-6">
          For your account&apos;s security, you must choose a new password before continuing.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="cp-current" className="block text-sm font-semibold text-slate-700 mb-1">Current password</label>
            <input
              id="cp-current"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition"
            />
          </div>
          <div>
            <label htmlFor="cp-new" className="block text-sm font-semibold text-slate-700 mb-1">New password</label>
            <input
              id="cp-new"
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
              minLength={12}
              autoComplete="new-password"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition"
            />
            {next && (
              <div className="mt-2 space-y-2">
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= score ? STRENGTH_COLORS[score] : "bg-slate-200"}`} />
                  ))}
                </div>
                <p className="text-xs font-medium text-slate-500">{STRENGTH_LABELS[score]}</p>
                {reasons.length > 0 && (
                  <ul className="text-xs text-slate-500 list-disc pl-4">
                    {reasons.map((r) => <li key={r}>{reasonText(r)}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
          <div>
            <label htmlFor="cp-confirm" className="block text-sm font-semibold text-slate-700 mb-1">Confirm new password</label>
            <input
              id="cp-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={12}
              autoComplete="new-password"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition"
            />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
          <button
            type="submit"
            disabled={loading || !current || next.length < 12 || next !== confirm}
            className="w-full py-3 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700 transition disabled:opacity-50"
          >
            {loading ? "Updating..." : "Update password and continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
