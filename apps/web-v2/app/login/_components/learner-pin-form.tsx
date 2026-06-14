"use client";

import * as React from "react";
import Link from "next/link";
import { AuthInput } from "@aivo/ui/auth";
import { useTranslations } from "next-intl";

export function LearnerPinForm({
  id,
  action,
}: {
  readonly id: string;
  readonly action: ((formData: FormData) => Promise<void>) | undefined;
}) {
  const t = useTranslations("auth.login");
  const [pin, setPin] = React.useState("");
  return (
    <form id={id} action={action} className="flex flex-col gap-4">
      <AuthInput
        id="parentId"
        name="parentId"
        label={t("learner_parent_label")}
        type="text"
        autoComplete="username"
        required
      />
      <AuthInput
        id="learnerId"
        name="learnerId"
        label={t("learner_profile_label")}
        type="text"
        autoComplete="off"
        required
      />
      <AuthInput
        id="pin"
        name="pin"
        label={t("learner_pin_label")}
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
        {t("learner_pin_helper")}
      </p>
      <Link href="/onboarding/recovery" className="text-sm font-semibold text-iw-primary hover:underline">
        {t("learner_help_link")}
      </Link>
    </form>
  );
}
