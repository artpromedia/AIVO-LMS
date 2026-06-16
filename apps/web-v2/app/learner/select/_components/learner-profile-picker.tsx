"use client";

import * as React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { LearnerAvatar } from "@/components/learner/learner-avatar";
import { PinPad } from "@/components/auth/pin-pad";
import { MascotEncouragementCard } from "@/components/auth/auth-split-layout";

/**
 * LearnerProfilePicker — design #1 "Choose your profile". A kid-facing two-step
 * picker: tap an avatar, then tap a PIN on the keypad. Submitting posts the
 * chosen learnerId + PIN to the `enterAsLearner` server action (the PIN-gated
 * hand-off that swaps the session to the learner). Authorization and PIN
 * verification stay entirely in the action; on failure it redirects to the
 * hand-off page / set-PIN step, so this component only owns selection + entry.
 */
type LearnerOption = {
  id: string;
  displayName: string;
  ageRange?: string | null;
  gradeBand?: string | null;
};

export function LearnerProfilePicker({
  learners,
  action,
}: {
  learners: ReadonlyArray<LearnerOption>;
  action: (formData: FormData) => Promise<void>;
}) {
  const t = useTranslations("learner.select");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [pin, setPin] = React.useState("");

  const selected = learners.find((l) => l.id === selectedId) ?? null;
  const ready = /^\d{4,6}$/.test(pin);

  if (!selected) {
    return (
      <div className="flex flex-col gap-6">
        <div className="text-center">
          <h1 className="font-iw-display text-2xl font-bold text-iw-ink sm:text-3xl">
            {t("choose_profile_title")}
          </h1>
          <p className="mt-2 text-sm text-iw-ink-muted">{t("choose_profile_subtitle")}</p>
        </div>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3" role="list">
          {learners.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(l.id);
                  setPin("");
                }}
                className="group flex h-full w-full flex-col items-center gap-3 rounded-iw-card border border-iw-border bg-white p-4 transition hover:border-iw-primary hover:bg-iw-accent-soft/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-2 focus-visible:ring-offset-iw-bg sm:p-5"
                aria-label={t("view_as_aria", { name: l.displayName })}
              >
                <LearnerAvatar name={l.displayName} size="lg" className="h-16 w-16 text-2xl sm:h-20 sm:w-20" />
                <span className="text-center">
                  <span className="block font-iw-display text-base font-semibold text-iw-ink">
                    {l.displayName}
                  </span>
                  {l.ageRange || l.gradeBand ? (
                    <span className="mt-0.5 block text-xs text-iw-ink-muted">
                      {l.ageRange ?? t("age_not_set")}
                      {l.gradeBand ? ` · ${l.gradeBand}` : ""}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
          <li>
            <Link
              href="/parent/learners/new"
              className="group flex h-full w-full flex-col items-center justify-center gap-3 rounded-iw-card border border-dashed border-iw-border bg-white p-4 transition hover:border-iw-primary hover:bg-iw-accent-soft/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-2 focus-visible:ring-offset-iw-bg sm:p-5"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-iw-accent-soft text-iw-primary sm:h-20 sm:w-20">
                <Plus className="h-7 w-7" aria-hidden="true" />
              </span>
              <span className="font-iw-display text-base font-semibold text-iw-ink">
                {t("add_profile")}
              </span>
            </Link>
          </li>
        </ul>
        <p className="text-center text-sm text-iw-ink-muted">{t("feedback_pick")}</p>
        <MascotEncouragementCard
          className="md:hidden"
          title={t("panel_title")}
          body={t("panel_body")}
        />
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="learnerId" value={selected.id} />
      <input type="hidden" name="pin" value={pin} />
      <div className="flex flex-col items-center gap-3 text-center">
        <LearnerAvatar name={selected.displayName} size="lg" className="h-20 w-20 text-2xl" />
        <div>
          <h1 className="font-iw-display text-2xl font-bold text-iw-ink">{selected.displayName}</h1>
          <p className="mt-1 text-sm text-iw-ink-muted">{t("enter_pin")}</p>
        </div>
      </div>

      <PinPad
        value={pin}
        onChange={setPin}
        length={6}
        clearLabel={t("clear")}
        backspaceLabel={t("backspace")}
      />

      <MascotEncouragementCard
        className="md:hidden"
        title={t("panel_title")}
        body={t("panel_body")}
      />

      <div className="flex flex-col gap-3">
        <button
          type="submit"
          disabled={!ready}
          aria-disabled={!ready}
          className={[
            "inline-flex min-h-[52px] w-full items-center justify-center rounded-full px-7 text-base font-semibold text-iw-primary-fg transition",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-2 focus-visible:ring-offset-iw-bg",
            ready
              ? "bg-iw-primary shadow-[0_10px_30px_-12px_rgba(124,108,246,0.7)] hover:-translate-y-0.5 hover:bg-iw-primary-hover"
              : "cursor-not-allowed bg-iw-primary/40",
          ].join(" ")}
        >
          {t("sign_in")}
        </button>
        <button
          type="button"
          onClick={() => {
            setSelectedId(null);
            setPin("");
          }}
          className="text-center text-sm font-semibold text-iw-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-2 focus-visible:ring-offset-iw-bg rounded"
        >
          {t("choose_profile_title")}
        </button>
      </div>
    </form>
  );
}
