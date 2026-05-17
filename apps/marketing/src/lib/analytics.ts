declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "";

export function trackEvent(action: string, params?: Record<string, string | number | boolean>) {
  if (typeof window !== "undefined" && window.gtag && GA_MEASUREMENT_ID) {
    window.gtag("event", action, params);
  }
}

export function trackCTAClick(ctaName: string, destination: string) {
  trackEvent("cta_click", {
    cta_name: ctaName,
    destination,
  });
}

export function trackFormSubmission(formName: string) {
  trackEvent("form_submission", {
    form_name: formName,
  });
}

export function trackPricingSelection(planName: string) {
  trackEvent("pricing_selection", {
    plan_name: planName,
  });
}

export function trackSignupInitiation(source: string) {
  trackEvent("signup_initiation", {
    source,
  });
}
