import { trackEvent, GA_MEASUREMENT_ID } from "../analytics";
import type { MarketingEventName, MarketingEventPayload } from "./events";

export interface AnalyticsProvider {
  name: string;
  isReady(): boolean;
  track(event: MarketingEventName, payload?: MarketingEventPayload): void;
}

export const googleAnalyticsProvider: AnalyticsProvider = {
  name: "google-analytics",
  isReady() {
    return (
      typeof window !== "undefined" && !!GA_MEASUREMENT_ID && typeof window.gtag === "function"
    );
  },
  track(event, payload) {
    trackEvent(event, payload as Record<string, string | number | boolean> | undefined);
  },
};

export const consoleProvider: AnalyticsProvider = {
  name: "console",
  isReady() {
    return process.env.NODE_ENV !== "production";
  },
  track(event, payload) {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.debug("[analytics]", event, payload ?? {});
    }
  },
};

const providers: AnalyticsProvider[] = [googleAnalyticsProvider, consoleProvider];

export function trackMarketingEvent(
  event: MarketingEventName,
  payload?: MarketingEventPayload,
): void {
  for (const p of providers) {
    if (p.isReady()) {
      try {
        p.track(event, payload);
      } catch {
        // never let analytics break the page
      }
    }
  }
}
