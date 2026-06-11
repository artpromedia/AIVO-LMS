/**
 * Sentry — browser init for web-v2.
 *
 * Runs once per page load (Next loads this before hydration). DSN-less
 * environments initialize disabled. Every event passes the shared COPPA
 * scrubber; session replay is deliberately NOT enabled — this product
 * serves children and replay capture is not part of the telemetry
 * contract (docs/legal/privacy-program.md).
 */
import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@aivo/observability/sentry-scrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend: (event) => scrubSentryEvent(event),
  beforeSendTransaction: (event) => scrubSentryEvent(event),
  initialScope: { tags: { surface: "web-v2", runtime: "browser" } },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
