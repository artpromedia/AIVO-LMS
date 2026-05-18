"use client";
import { useId, useState } from "react";
import { useLeadForm } from "./useLeadForm";
import { FormField, fieldInputClass } from "./FormField";
import { FormSuccessPanel, FormErrorPanel } from "./FormPanels";

const GRADE_BANDS = [
  "Pre-K (ages 3–5)",
  "Lower elementary (K–2)",
  "Upper elementary (3–5)",
  "Middle school (6–8)",
  "High school (9–12)",
  "Mixed / multiple learners",
];

const INTERESTS = [
  "Today's Mission (daily routine)",
  "LessonRun (guided lessons)",
  "Homework Helper",
  "Special education support",
  "Just exploring",
];

type Payload = {
  name: string;
  email: string;
  gradeBand: string;
  interestArea: string;
  message: string;
  consent: boolean;
};

export function WaitlistForm() {
  const uid = useId();
  const id = (k: string) => `${uid}-${k}`;
  const { status, errorMessage, submit, reset } = useLeadForm<Payload>({
    type: "waitlist",
    trackingName: "waitlist_form",
  });
  const [form, setForm] = useState<Payload>({
    name: "",
    email: "",
    gradeBand: GRADE_BANDS[1],
    interestArea: INTERESTS[0],
    message: "",
    consent: false,
  });
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Partial<Record<keyof Payload, string>>>({});

  function validate(): boolean {
    const next: Partial<Record<keyof Payload, string>> = {};
    if (!form.name.trim()) next.name = "Please share your name.";
    if (!form.email.trim()) next.email = "We'll need an email to let you in.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "That email looks off.";
    if (!form.consent) next.consent = "Please confirm so we can email you.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    await submit({ ...form, website } as unknown as Payload);
  }

  if (status === "success") {
    return (
      <FormSuccessPanel
        title="You're on the list."
        body={
          <>
            We'll email <strong>{form.email}</strong> as new spots open. No spam, no sharing — just
            a heads-up when it's your turn.
          </>
        }
        primaryHref="/thank-you"
        primaryLabel="See what's next"
      />
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-5">
      <div className="hidden" aria-hidden="true">
        <label htmlFor={id("website")}>Website</label>
        <input
          id={id("website")}
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <FormField id={id("name")} label="Your name" required error={errors.name}>
          <input
            id={id("name")}
            type="text"
            autoComplete="name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={fieldInputClass}
          />
        </FormField>
        <FormField id={id("email")} label="Email" required error={errors.email}>
          <input
            id={id("email")}
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={fieldInputClass}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <FormField id={id("gradeBand")} label="Learner age / grade band">
          <select
            id={id("gradeBand")}
            value={form.gradeBand}
            onChange={(e) => setForm({ ...form, gradeBand: e.target.value })}
            className={fieldInputClass}
          >
            {GRADE_BANDS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id={id("interestArea")} label="Most interested in">
          <select
            id={id("interestArea")}
            value={form.interestArea}
            onChange={(e) => setForm({ ...form, interestArea: e.target.value })}
            className={fieldInputClass}
          >
            {INTERESTS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <FormField
        id={id("message")}
        label="Anything you'd like us to know?"
        hint="Optional — about your learner, your goals, what they love or struggle with."
      >
        <textarea
          id={id("message")}
          rows={4}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          className={fieldInputClass}
        />
      </FormField>

      <div className="space-y-1.5">
        <label htmlFor={id("consent")} className="flex items-start gap-2 text-sm text-slate-700">
          <input
            id={id("consent")}
            type="checkbox"
            checked={form.consent}
            onChange={(e) => setForm({ ...form, consent: e.target.checked })}
            aria-describedby={errors.consent ? id("consent-error") : undefined}
            aria-invalid={errors.consent ? true : undefined}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
          />
          <span>
            I agree AIVO can email me about my waitlist spot. See our{" "}
            <a href="/privacy-policy" className="font-semibold text-purple-700 underline">
              privacy policy
            </a>
            .
          </span>
        </label>
        {errors.consent ? (
          <p id={id("consent-error")} className="text-xs font-semibold text-rose-700" role="alert">
            {errors.consent}
          </p>
        ) : null}
      </div>

      {status === "error" ? (
        <FormErrorPanel message={errorMessage} onRetry={() => reset()} />
      ) : null}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-primary to-purple-600 px-7 py-3 font-bold text-white shadow-sm transition hover:from-primary-dark hover:to-purple-700 disabled:opacity-60"
      >
        {status === "submitting" ? "Saving your spot…" : "Join the waitlist"}
      </button>
    </form>
  );
}
