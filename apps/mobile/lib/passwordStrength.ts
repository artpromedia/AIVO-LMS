/**
 * Client-side password strength estimator shared by the mobile auth flows.
 *
 * Used by the forced-change-password screen (`change-password.tsx`) and the
 * email-link reset screen (`reset-password.tsx`). Mirrors the simple
 * heuristic on `apps/web/src/app/reset-password/page.tsx` so the two
 * platforms feel the same.
 *
 * This is *strictly* an affordance — the authoritative policy check is
 * server-side in identity-svc's `evaluatePassword`, which the screens still
 * surface via the `reasons[]` array on a 400 response. Keeping a copy of
 * the rule set on the web/mobile clients in lockstep with the server would
 * require a generated bundle; that's tracked in the long-term hygiene plan.
 *
 * The score is `0..4` where 0 ≈ "very weak" and 4 ≈ "very strong". The
 * `reasons` array uses the same `too_short` / `too_weak` codes the server
 * returns, so the screens can pipe both client- and server-side reasons
 * through a single `reasonText` mapping.
 */
export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  reasons: string[];
}

export function estimatePasswordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, reasons: [] };
  const len = password.length;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z0-9]/].filter((re) => re.test(password)).length;
  // Length-clamped at 32 so absurdly long passwords don't game the meter,
  // class-diversity bonus, repeated-char penalty for things like "aaa".
  let entropy = Math.min(len, 32) * 2 + classes * 6;
  if (/(.)\1{2,}/.test(password)) entropy -= 8;

  let score: 0 | 1 | 2 | 3 | 4 = 0;
  if (entropy >= 18) score = 1;
  if (entropy >= 30) score = 2;
  if (entropy >= 42) score = 3;
  if (entropy >= 56) score = 4;

  const reasons: string[] = [];
  // 12 char minimum matches the user-facing copy and the most permissive
  // server policy (staff bumps to 14, surfaced via server-side reasons).
  if (len < 12) reasons.push("too_short");
  if (score < 3) reasons.push("too_weak");
  return { score, reasons };
}
