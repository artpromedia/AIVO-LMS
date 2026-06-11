/**
 * Next.js instrumentation hook — boots Sentry for the matching server
 * runtime and forwards RSC / route-handler request errors.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * Wave A (G2): the nodejs runtime additionally runs the LLM-config boot
 * probe. In production it verifies the AI provider key and the
 * assessment-svc service token end-to-end and THROWS on a definitive
 * auth/config failure, so a deploy that could only ever serve
 * silently-degraded personalization never takes traffic. Outside the
 * production runtime (dev, build phase, AIVO_TEST_MODE) it is a no-op.
 */
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
    const { assertLlmConfigAtBoot } = await import("./lib/boot/llm-config-probe");
    await assertLlmConfigAtBoot();
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
