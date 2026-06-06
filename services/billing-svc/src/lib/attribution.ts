/**
 * Campaign attribution for subscriptions.
 *
 * Picks the originating coupon code + utm_* out of a request body or a Stripe
 * metadata bag, so a trial/subscription created via a coupon or a
 * `?plan=…&coupon=…&utm_…` signup link carries that attribution on its
 * `subscriptions.metadata` — the basis for pilots-started → pilots-converted
 * reporting.
 */
export interface SubscriptionAttribution {
  couponCode?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Extract attribution, accepting both camelCase and snake_case keys. */
export function pickAttribution(
  src: Record<string, unknown> | null | undefined,
): SubscriptionAttribution {
  const s = src ?? {};
  const out: SubscriptionAttribution = {};
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
