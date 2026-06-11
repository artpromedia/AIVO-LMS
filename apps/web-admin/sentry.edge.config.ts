/**
 * Sentry — Edge runtime init for web-admin (middleware + edge routes).
 * Same DSN-optional + scrubbing contract as the Node config.
 */
import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@aivo/observability/sentry-scrub";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment:
    process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
  release:
    process.env.SENTRY_RELEASE ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GITHUB_SHA,
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
  sendDefaultPii: false,
  beforeSend: (event) => scrubSentryEvent(event),
  beforeSendTransaction: (event) => scrubSentryEvent(event),
  initialScope: { tags: { surface: "web-admin", runtime: "edge" } },
});
