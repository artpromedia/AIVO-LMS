/**
 * Campaign attribution carried from the marketing ?plan=…&coupon=…&utm_…
 * signup link into Stripe Checkout, so a coupon/UTM-driven trial can be traced
 * to its campaign.
 *
 * Pure + client-safe: `window`/`sessionStorage` are only touched inside the
 * client helpers (never at module load), so the BFF route can import
 * `pickCheckoutAttribution` server-side without crashing SSR.
 */
export interface CheckoutAttribution {
  couponCode?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Extract attribution from a body/object, accepting camelCase + snake_case. */
export function pickCheckoutAttribution(
  src: Record<string, unknown> | null | undefined,
): CheckoutAttribution {
  const s = src ?? {};
  const out: CheckoutAttribution = {};
  const couponCode = str(s.couponCode) ?? str(s.coupon) ?? str(s.coupon_code);
  const utmSource = str(s.utmSource) ?? str(s.utm_source);
  const utmMedium = str(s.utmMedium) ?? str(s.utm_medium);
  const utmCampaign = str(s.utmCampaign) ?? str(s.utm_campaign);
  if (couponCode) out.couponCode = couponCode;
  if (utmSource) out.utmSource = utmSource;
  if (utmMedium) out.utmMedium = utmMedium;
  if (utmCampaign) out.utmCampaign = utmCampaign;
  return out;
}

// The snake_case query keys carried on the signup link.
const QUERY_KEYS = ["utm_source", "utm_medium", "utm_campaign", "coupon"] as const;

/** Capture any utm or coupon params on the current URL into sessionStorage (client). */
export function captureCheckoutAttribution(): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  for (const key of QUERY_KEYS) {
    const value = params.get(key);
    if (value) {
      try {
        window.sessionStorage.setItem(`aivo_attr_${key}`, value);
      } catch {
        // sessionStorage may be unavailable; attribution is best-effort.
      }
    }
  }
}

/** Read attribution on the client: current URL first, then sessionStorage. */
export function readCheckoutAttribution(): CheckoutAttribution {
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
  return pickCheckoutAttribution({
    coupon: get("coupon"),
    utm_source: get("utm_source"),
    utm_medium: get("utm_medium"),
    utm_campaign: get("utm_campaign"),
  });
}
