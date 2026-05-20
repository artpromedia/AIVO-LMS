"use client";
import * as React from "react";
import Link from "next/link";
import { AuthShell, AuthCard, ReassuranceCard } from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";

/**
 * /onboarding/pin
 *
 * Age-appropriate learner PIN. 4 digits, big touch targets, no
 * keyboard-only assumption. The PIN is the learner's gate into their
 * own profile after a parent has set up the account — it is NOT a
 * sign-in credential by itself; the device must already be associated
 * with a verified parent account.
 */
export default function PinSetupPage() {
  const [pin, setPin] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const mismatch = confirm.length === 4 && confirm !== pin;
  const ready = pin.length === 4 && confirm === pin;

  return (
    <AuthShell>
      <AuthCard
        icon={<AivoIcon name="consentLock" size={32} />}
        eyebrow="Learner PIN"
        title="Pick a 4-digit PIN for your child."
        subtitle="Your child uses this PIN to unlock their learning on this device. The PIN never replaces your parent sign-in."
        reassurance={
          <ReassuranceCard
            tone="safety"
            title="A PIN is a soft lock, not a vault."
            body="It keeps a sibling from opening the wrong profile. Sensitive actions still require a parent sign-in."
          />
        }
        actions={
          <>
            <Link
              href={ready ? "/onboarding/parent-verify" : "#"}
              aria-disabled={!ready}
              className={`w-full h-12 rounded-iw-control text-white font-semibold flex items-center justify-center ${
                ready
                  ? "bg-[var(--aivo-sensory-primary)] hover:opacity-95"
                  : "bg-[var(--aivo-sensory-primary)]/50 pointer-events-none"
              }`}
            >
              Save PIN
            </Link>
            <Link
              href="/onboarding/parent-verify"
              className="text-xs text-iw-text-muted text-center hover:underline"
            >
              Skip — set a PIN later from Settings
            </Link>
          </>
        }
      >
        <PinRing label="Choose PIN" value={pin} onChange={setPin} />
        <PinRing
          label="Confirm PIN"
          value={confirm}
          onChange={setConfirm}
          error={mismatch ? "Those don't match. Try again." : undefined}
        />
      </AuthCard>
    </AuthShell>
  );
}

function PinRing({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  error?: string;
}) {
  const id = React.useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-iw-text-strong">
        {label}
      </label>
      <input
        id={id}
        inputMode="numeric"
        pattern="\d{4}"
        maxLength={4}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        aria-invalid={error ? true : undefined}
        className={`h-14 px-3 rounded-iw-control bg-white border text-center text-2xl font-bold tracking-[0.6em] tabular-nums outline-none transition-colors ${
          error
            ? "border-[var(--aivo-status-error-strong)] focus:ring-2 focus:ring-[var(--aivo-status-error-strong)]/30"
            : "border-iw-border focus:border-[var(--aivo-sensory-primary)] focus:ring-2 focus:ring-[var(--aivo-sensory-primary)]/20"
        }`}
      />
      {error ? (
        <p
          role="alert"
          className="text-xs text-[var(--aivo-status-error-strong)]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
