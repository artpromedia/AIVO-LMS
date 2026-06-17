"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

/**
 * Resend-code control for the MFA challenge. Wraps the `resendMfaAction`
 * server action in a form and gates the button behind a 30s countdown so
 * a user can't hammer the email-OTP resend endpoint. The countdown is
 * cosmetic rate-limiting only — identity-svc still enforces the real
 * resend ceiling (429 → resend_exhausted).
 */
export function MfaResend({
  action,
  idleLabel,
  countdownLabel,
  initialSeconds = 30,
}: {
  readonly action: () => Promise<void>;
  readonly idleLabel: string;
  /** Template containing `{seconds}`, e.g. "Resend code in {seconds}s". */
  readonly countdownLabel: string;
  readonly initialSeconds?: number;
}) {
  const [seconds, setSeconds] = React.useState(initialSeconds);

  React.useEffect(() => {
    if (seconds <= 0) return;
    const id = window.setInterval(() => {
      setSeconds((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [seconds]);

  const waiting = seconds > 0;

  return (
    <form action={action} className="w-full">
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        disabled={waiting}
        className="w-full text-iw-primary disabled:opacity-60"
      >
        {waiting ? countdownLabel.replace("{seconds}", String(seconds)) : idleLabel}
      </Button>
    </form>
  );
}
