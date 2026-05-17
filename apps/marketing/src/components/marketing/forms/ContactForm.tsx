"use client";
import { useId, useState } from "react";
import { useLeadForm } from "./useLeadForm";
import { FormField, fieldInputClass } from "./FormField";
import { FormSuccessPanel, FormErrorPanel } from "./FormPanels";

const REASONS = [
  { value: "general", label: "General inquiry" },
  { value: "support", label: "Help with my account" },
  { value: "privacy", label: "Privacy or data question" },
  { value: "press", label: "Press / media" },
  { value: "partnership", label: "Partnership" },
];

type Payload = {
  name: string;
  email: string;
  reason: string;
  message: string;
  consent: boolean;
};

export function ContactForm() {
  const uid = useId();
  const id = (k: string) => `${uid}-${k}`;
  const { status, errorMessage, submit, reset } = useLeadForm<Payload>({
    type: "contact",
    trackingName: "contact_form",
  });
  const [form, setForm] = useState<Payload>({
    name: "",
    email: "",
    reason: "general",
    message: "",
    consent: false,
  });
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Partial<Record<keyof Payload, string>>>({});

  function validate(): boolean {
    const next: Partial<Record<keyof Payload, string>> = {};
    if (!form.name.trim()) next.name = "Please share your name.";
    if (!form.email.trim()) next.email = "We'll need an email to reply.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "That email looks off.";
    if (!form.message.trim()) next.message = "Tell us a little about your question.";
    if (!form.consent) next.consent = "Please confirm so we can reply.";
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
        title="Message sent."
        body={<>We typically reply within one business day. Check your inbox at <strong>{form.email}</strong>.</>}
        primaryHref="/"
        primaryLabel="Back to home"
        onSecondary={() => {
          setForm({ name: "", email: "", reason: "general", message: "", consent: false });
          reset();
        }}
        secondaryLabel="Send another message"
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
        <FormField id={id("name")} label="Full name" required error={errors.name}>
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

      <FormField id={id("reason")} label="Reason for reaching out">
        <select
          id={id("reason")}
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
          className={fieldInputClass}
        >
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField id={id("message")} label="Your message" required error={errors.message}>
        <textarea
          id={id("message")}
          rows={5}
          required
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
            I agree AIVO can email me about my question. See our{" "}
            <a href="/privacy-policy" className="font-semibold text-purple-700 underline">privacy policy</a>.
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
        {status === "submitting" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
