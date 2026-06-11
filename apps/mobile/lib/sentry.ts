/**
 * Sentry init for the mobile app (Sprint A2).
 *
 * DSN comes from EXPO_PUBLIC_SENTRY_DSN; without it the SDK initializes
 * disabled and every capture is a no-op — local dev and forks need no
 * secret. Every event passes the same COPPA scrubbing rules as the web
 * surfaces (packages/observability/src/sentry-scrub.ts): hashed user id,
 * no learner identifiers, no emails/names/IEP/medical text, no session
 * replay of any kind.
 *
 * The scrubber is duplicated here as an import from @aivo/observability —
 * single source of truth, bundled by Metro like any workspace dep.
 */
import * as Sentry from "@sentry/react-native";
import { scrubSentryEvent } from "@aivo/observability/sentry-scrub";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initSentry(): void {
  Sentry.init({
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? (__DEV__ ? "development" : "production"),
    // EAS injects the runtime/app version; fall back to the OTA update id.
    release: process.env.EXPO_PUBLIC_SENTRY_RELEASE,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend: (event) => scrubSentryEvent(event),
    beforeSendTransaction: (event) => scrubSentryEvent(event),
    initialScope: { tags: { surface: "mobile" } },
  });
}

export { Sentry };
