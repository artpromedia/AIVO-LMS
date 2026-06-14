"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AuthInput } from "@aivo/ui/auth";

export function LearnerPinForm({
  id,
  action,
}: {
  readonly id: string;
  readonly action: ((formData: FormData) => Promise<void>) | undefined;
}) {
  const t = useTranslations("auth");
  const [pin, setPin] = React.useState("");
  return (
    <form id={id} action={action} className="flex flex-col gap-4">
      <AuthInput
        id="parentId"
        name="parentId"
        label="Parent email or family ID"
        type="text"
        autoComplete="username"
        required
      />
      <AuthInput
        id="learnerId"
        name="learnerId"
        label="Learner profile ID"
        type="text"
        autoComplete="off"
        required
      />
      <AuthInput
        id="pin"
        name="pin"
        label="Learner PIN"
        type="password"
        inputMode="numeric"
        autoComplete="one-time-code"
        minLength={4}
        maxLength={6}
        value={pin}
        onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
        required
      />
      <p className="text-xs leading-relaxed text-iw-ink-muted">
        Learners use only their app PIN. Adults should use the standard sign-in tab.
      </p>
      <Link href="/onboarding/recovery" className="text-sm font-semibold text-iw-primary hover:underline">
        Need help finding a learner profile?
      </Link>
    </form>
  );
}
