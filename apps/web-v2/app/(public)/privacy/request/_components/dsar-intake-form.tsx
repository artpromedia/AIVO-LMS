"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Step = "form" | "confirmed";

interface ConfirmData {
  id: string;
  type: string;
  regulation: string;
  createdAt: string;
  sla: { ackHours: number; fulfillmentDays: number };
}

const DSAR_TYPES = [
  { value: "access", label: "Access — see what data we hold" },
  { value: "erasure", label: "Erasure — delete my data (right to be forgotten)" },
  { value: "portability", label: "Portability — export my data" },
  { value: "rectification", label: "Rectification — correct inaccurate data" },
  { value: "restriction", label: "Restriction — restrict processing" },
  { value: "objection", label: "Objection — object to processing" },
];

const REGULATIONS = [
  { value: "gdpr", label: "GDPR (EU / UK)" },
  { value: "ccpa", label: "CCPA (California)" },
  { value: "ferpa", label: "FERPA (Education)" },
];

export function DsarIntakeForm() {
  const [step, setStep] = useState<Step>("form");
  const [confirmed, setConfirmed] = useState<ConfirmData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Form state
  const [requesterEmail, setRequesterEmail] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [dsarType, setDsarType] = useState("access");
  const [regulation, setRegulation] = useState("gdpr");
  const [onBehalfOfMinor, setOnBehalfOfMinor] = useState(false);
  const [isSelf, setIsSelf] = useState(true);

  function submit() {
    setError(null);
    start(async () => {
      const res = await fetch("/api/bff/privacy/dsar-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requesterEmail,
          subjectId: subjectId.trim() || requesterEmail.trim(),
          type: dsarType,
          regulation,
          onBehalfOfMinor: onBehalfOfMinor || !isSelf,
          subjectEmail: isSelf ? requesterEmail : undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error?.message ?? "Submission failed. Please try again.");
        return;
      }
      setConfirmed(body.data);
      setStep("confirmed");
    });
  }

  if (step === "confirmed" && confirmed) {
    return (
      <div className="rounded-iw-card border border-iw-border bg-iw-raised p-8 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-aivo-success/15 text-aivo-success text-xl font-bold mb-4">
          ✓
        </div>
        <h2 className="font-iw-display text-2xl font-bold text-iw-ink">Request submitted</h2>
        <p className="mt-2 text-iw-ink-muted">
          Your request ID is:{" "}
          <span className="font-mono font-semibold text-iw-ink">{confirmed.id}</span>
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 text-sm">
          <div className="rounded-iw-control border border-iw-border bg-iw-card p-4 text-left">
            <p className="font-semibold">Acknowledgment</p>
            <p className="text-iw-ink-muted mt-1">
              Within <strong>{confirmed.sla.ackHours} hours</strong>
            </p>
          </div>
          <div className="rounded-iw-control border border-iw-border bg-iw-card p-4 text-left">
            <p className="font-semibold">Fulfillment</p>
            <p className="text-iw-ink-muted mt-1">
              Within <strong>{confirmed.sla.fulfillmentDays} days</strong>
            </p>
          </div>
        </div>
        <p className="mt-4 text-xs text-iw-ink-muted">
          Type: <span className="capitalize">{confirmed.type}</span> · Regulation:{" "}
          <span className="uppercase">{confirmed.regulation}</span> · Submitted:{" "}
          {new Date(confirmed.createdAt).toLocaleString()}
        </p>
        <p className="mt-4 text-sm text-iw-ink-muted">
          We will contact you at the email address you provided.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-iw-card border border-iw-border bg-iw-raised p-8 space-y-6">
      {/* Identity verification step */}
      <section>
        <h2 className="font-iw-display text-lg font-semibold text-iw-ink mb-4">1. Your identity</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1.5 text-iw-ink" htmlFor="req-email">
              Your email address <span className="text-aivo-danger">*</span>
            </label>
            <Input
              id="req-email"
              type="email"
              required
              value={requesterEmail}
              onChange={(e) => setRequesterEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-3 text-sm cursor-pointer">
              <input
                type="radio"
                name="subject-role"
                className="accent-iw-primary"
                checked={isSelf}
                onChange={() => {
                  setIsSelf(true);
                  setOnBehalfOfMinor(false);
                }}
              />
              <span>I am the data subject (submitting for myself)</span>
            </label>
            <label className="flex items-center gap-3 text-sm cursor-pointer">
              <input
                type="radio"
                name="subject-role"
                className="accent-iw-primary"
                checked={!isSelf && !onBehalfOfMinor}
                onChange={() => {
                  setIsSelf(false);
                  setOnBehalfOfMinor(false);
                }}
              />
              <span>I am an authorized representative acting for an adult</span>
            </label>
            <label className="flex items-center gap-3 text-sm cursor-pointer">
              <input
                type="radio"
                name="subject-role"
                className="accent-iw-primary"
                checked={onBehalfOfMinor}
                onChange={() => {
                  setIsSelf(false);
                  setOnBehalfOfMinor(true);
                }}
              />
              <span>I am a parent/guardian acting for a learner under 13 (COPPA)</span>
            </label>
          </div>

          {!isSelf && (
            <div>
              <label
                className="block text-sm font-semibold mb-1.5 text-iw-ink"
                htmlFor="subject-id"
              >
                Subject identifier (learner ID, email, or username){" "}
                <span className="text-aivo-danger">*</span>
              </label>
              <Input
                id="subject-id"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                placeholder="lrn_xxxxx or learner@school.edu"
              />
            </div>
          )}
        </div>
      </section>

      {/* Request details */}
      <section>
        <h2 className="font-iw-display text-lg font-semibold text-iw-ink mb-4">
          2. Request details
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1.5 text-iw-ink" htmlFor="dsar-type">
              Request type <span className="text-aivo-danger">*</span>
            </label>
            <select
              id="dsar-type"
              className="h-11 w-full rounded-iw-control border border-iw-border bg-iw-raised px-3.5 text-sm text-iw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring"
              value={dsarType}
              onChange={(e) => setDsarType(e.target.value)}
            >
              {DSAR_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5 text-iw-ink" htmlFor="regulation">
              Applicable regulation
            </label>
            <select
              id="regulation"
              className="h-11 w-full rounded-iw-control border border-iw-border bg-iw-raised px-3.5 text-sm text-iw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring"
              value={regulation}
              onChange={(e) => setRegulation(e.target.value)}
            >
              {REGULATIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {error && (
        <p role="alert" className="text-sm text-aivo-danger">
          {error}
        </p>
      )}

      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={pending || !requesterEmail.trim() || (!isSelf && !subjectId.trim())}
        onClick={submit}
      >
        {pending ? "Submitting…" : "Submit request"}
      </Button>

      <p className="text-xs text-iw-ink-muted text-center">
        By submitting this form you agree we may use your email address solely to process and
        respond to this request. See our{" "}
        <a href="/onboarding/privacy" className="underline hover:text-iw-primary">
          Privacy Policy
        </a>
        .
      </p>
    </div>
  );
}
