"use client";

/**
 * Core Web Vitals → Sentry (Sprint A2).
 *
 * Next.js reports CLS/LCP/INP/FCP/TTFB per route; we forward each metric as
 * a Sentry measurement-style event tagged with the route so dashboards can
 * watch the learner-critical surfaces. No-ops when Sentry is DSN-less.
 * Renders nothing.
 */
import { useReportWebVitals } from "next/web-vitals";
import { usePathname } from "next/navigation";
import * as Sentry from "@sentry/nextjs";

export function WebVitalsReporter() {
  const pathname = usePathname();
  useReportWebVitals((metric) => {
    const client = Sentry.getClient();
    if (!client) return;
    // Distribution-style metric per vital, tagged by route group (first two
    // path segments — enough to separate /learner/home from /parent/home
    // without cardinality explosions from ids).
    const routeGroup = (pathname ?? "/").split("/").slice(0, 3).join("/") || "/";
    Sentry.addBreadcrumb({
      category: "web-vital",
      message: metric.name,
      level: "info",
      data: { value: metric.value, rating: metric.rating, route: routeGroup },
    });
    if (metric.rating === "poor") {
      // Poor vitals surface as events so they can be alerted on, not just
      // attached to the next error.
      Sentry.captureMessage(`web-vital:${metric.name}:poor`, {
        level: "warning",
        tags: { route: routeGroup, vital: metric.name },
        extra: { value: metric.value, id: metric.id },
      });
    }
  });
  return null;
}
