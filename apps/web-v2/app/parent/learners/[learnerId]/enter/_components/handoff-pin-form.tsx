"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * PIN entry for the parent → learner hand-off. The parent is already
 * authenticated, so this only collects the learner's 4–6 digit PIN; the
 * `learnerId` rides along as a hidden field and `parentId` is taken from the
 * session inside the `enterAsLearner` server action. On submit the action
 * verifies the PIN via identity-svc and swaps the session to the learner.
 */
export function HandoffPinForm({
  learnerId,
  action,
}: {
  readonly learnerId: string;
  readonly action: (formData: FormData) => Promise<void>;
}) {
  const t = useTranslations("parent.handoff");
  const [pin, setPin] = React.useState("");
  const ready = /^\d{4,6}$/.test(pin);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="learnerId" value={learnerId} />
      <label htmlFor="handoff-pin" className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-iw-text-strong">{t("pin_label")}</span>
        <input
          id="handoff-pin"
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          minLength={4}
          maxLength={6}
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
          required
          className="w-full rounded-iw-control border border-iw-border bg-white px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] text-iw-text-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-aivo-primary)]"
          aria-label={t("pin_label")}
        />
      </label>
      <p className="text-xs leading-relaxed text-iw-text-muted">{t("pin_helper")}</p>
      <Button type="submit" size="lg" disabled={!ready} data-testid="handoff-pin-submit">
        {t("submit")}
      </Button>
    </form>
  );
}
