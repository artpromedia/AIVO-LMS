"use client";
import { useEffect, useRef, useState } from "react";
import { trackFormSubmission } from "@/lib/analytics";

export type LeadFormStatus = "idle" | "submitting" | "success" | "error";

// Campaign attribution keys we persist for the session, so a lead submitted
// on /demo still carries the utm_*/coupon a visitor arrived with on the home
// page. Captured from the URL on mount; read back (URL first) at submit time.
const ATTRIBUTION_KEYS = ["utm_source", "utm_medium", "utm_campaign", "coupon"] as const;

function captureAttribution(): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  for (const key of ATTRIBUTION_KEYS) {
    const value = params.get(key);
    if (value) {
      try {
        window.sessionStorage.setItem(`aivo_attr_${key}`, value);
      } catch {
        // sessionStorage may be unavailable (private mode); attribution is
        // best-effort and must never break the form.
      }
    }
  }
}

function readAttribution(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const get = (key: string): string | undefined => {
    const fromUrl = params.get(key);
    if (fromUrl) return fromUrl;
    try {
      return window.sessionStorage.getItem(`aivo_attr_${key}`) || undefined;
    } catch {
      return undefined;
    }
  };
  const out: Record<string, string> = {};
  const utmSource = get("utm_source");
  const utmMedium = get("utm_medium");
  const utmCampaign = get("utm_campaign");
  const couponCode = get("coupon");
  if (utmSource) out.utmSource = utmSource;
  if (utmMedium) out.utmMedium = utmMedium;
  if (utmCampaign) out.utmCampaign = utmCampaign;
  if (couponCode) out.couponCode = couponCode;
  return out;
}

export function useLeadForm<T extends Record<string, unknown>>(opts: {
  type: string;
  trackingName: string;
}) {
  const [status, setStatus] = useState<LeadFormStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const submittedKeyRef = useRef<string | null>(null);

  // Capture any utm_*/coupon present when this form's page loads.
  useEffect(() => {
    captureAttribution();
  }, []);

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
        body: JSON.stringify({ type: opts.type, ...payload, ...readAttribution() }),
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
