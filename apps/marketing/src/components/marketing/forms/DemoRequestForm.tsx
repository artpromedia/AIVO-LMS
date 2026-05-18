"use client";
import { useId, useState } from "react";
import { useLeadForm } from "./useLeadForm";
import { FormField, fieldInputClass } from "./FormField";
import { FormSuccessPanel, FormErrorPanel } from "./FormPanels";

const ROLES = [
  "Teacher",
  "Special Education Lead",
  "Principal / Head of School",
  "Curriculum Director",
  "District Superintendent",
  "Therapist / Clinician",
  "Other",
];

const SIZES = [
  "Under 200 learners",
  "200–1,000 learners",
  "1,000–5,000 learners",
  "5,000–20,000 learners",
  "20,000+ learners",
];

const INTERESTS = [
  "Special education programs",
  "MTSS / RTI",
  "Whole-classroom rollout",
  "After-school / supplemental",
  "Research partnership",
  "Other",
];

type Payload = {
  name: string;
  email: string;
  company: string;
  role: string;
  schoolSize: string;
  interestArea: string;
  message: string;
  consent: boolean;
};

export function DemoRequestForm() {
  const uid = useId();
  const id = (k: string) => `${uid}-${k}`;
  const { status, errorMessage, submit, reset } = useLeadForm<Payload>({
    type: "demo",
    trackingName: "demo_request_form",
  });
  const [form, setForm] = useState<Payload>({
    name: "",
    email: "",
    company: "",
    role: ROLES[0],
    schoolSize: SIZES[1],
    interestArea: INTERESTS[0],
    message: "",
    consent: false,
  });
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Partial<Record<keyof Payload, string>>>({});

  function validate(): boolean {
    const next: Partial<Record<keyof Payload, string>> = {};
    if (!form.name.trim()) next.name = "Please share your name.";
    if (!form.email.trim()) next.email = "We'll need an email to follow up.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "That email looks off.";
    if (!form.company.trim()) next.company = "Which school, district, or organization?";
    if (!form.consent) next.consent = "Please confirm so we can reach out.";
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
        title="Demo request received."
        body={
          <>
            A member of our team will reach out to <strong>{form.email}</strong> within one business
            day to schedule a walkthrough that matches your role and rollout goals.
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
        <FormField
          id={id("email")}
          label="Work email"
          required
          error={errors.email}
          hint="Personal email is OK if you don't have one yet."
        >
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

      <FormField
        id={id("company")}
        label="School, district, or organization"
        required
        error={errors.company}
      >
        <input
          id={id("company")}
          type="text"
          autoComplete="organization"
          required
          value={form.company}
          onChange={(e) => setForm({ ...form, company: e.target.value })}
          className={fieldInputClass}
        />
      </FormField>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <FormField id={id("role")} label="Your role">
          <select
            id={id("role")}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className={fieldInputClass}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id={id("schoolSize")} label="Approximate size">
          <select
            id={id("schoolSize")}
            value={form.schoolSize}
            onChange={(e) => setForm({ ...form, schoolSize: e.target.value })}
            className={fieldInputClass}
          >
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <FormField id={id("interestArea")} label="What are you most interested in?">
        <select
          id={id("interestArea")}
          value={form.interestArea}
          onChange={(e) => setForm({ ...form, interestArea: e.target.value })}
          className={fieldInputClass}
        >
          {INTERESTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </FormField>

      <FormField
        id={id("message")}
        label="Anything else to share?"
        hint="Optional — timing, learner count, specific goals."
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
            I agree AIVO can email me about a demo. See our{" "}
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
        {status === "submitting" ? "Sending…" : "Request a demo"}
      </button>
    </form>
  );
}
