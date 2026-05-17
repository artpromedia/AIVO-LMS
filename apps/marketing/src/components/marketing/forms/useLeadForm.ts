"use client";
import { useRef, useState } from "react";
import { trackFormSubmission } from "@/lib/analytics";

export type LeadFormStatus = "idle" | "submitting" | "success" | "error";

export function useLeadForm<T extends Record<string, unknown>>(opts: {
  type: string;
  trackingName: string;
}) {
  const [status, setStatus] = useState<LeadFormStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const submittedKeyRef = useRef<string | null>(null);

  async function submit(payload: T) {
    const dedupKey = JSON.stringify({ type: opts.type, ...payload });
    if (submittedKeyRef.current === dedupKey && status === "success") {
      return;
    }
    setStatus("submitting");
    setErrorMessage("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: opts.type, ...payload }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "We couldn't send that. Please try again.");
      }
      submittedKeyRef.current = dedupKey;
      setStatus("success");
      trackFormSubmission(opts.trackingName);
    } catch (e) {
      setStatus("error");
      setErrorMessage(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  function reset() {
    setStatus("idle");
    setErrorMessage("");
    submittedKeyRef.current = null;
  }

  return { status, errorMessage, submit, reset };
}
