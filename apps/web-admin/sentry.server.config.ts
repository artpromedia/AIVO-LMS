/**
 * Sentry — Node (server) runtime init for web-admin.
 *
 * Loaded by instrumentation.ts. DSN-less environments (local dev without
 * telemetry, CI) initialize disabled and every capture becomes a no-op —
 * never a crash. All events pass the shared COPPA scrubber.
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
  // COPPA boundary — see packages/observability/src/sentry-scrub.ts.
  sendDefaultPii: false,
  beforeSend: (event) => scrubSentryEvent(event),
  beforeSendTransaction: (event) => scrubSentryEvent(event),
  initialScope: { tags: { surface: "web-admin", runtime: "node" } },
});
