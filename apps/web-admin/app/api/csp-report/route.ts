import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

/**
 * CSP violation report sink (Sprint A3). Browsers POST
 * application/csp-report (report-uri) payloads here; we log a structured
 * warning and forward a fingerprinted message to Sentry so a directive
 * regression after a deploy is visible within minutes.
 *
 * Always 204: report delivery must never error-loop a client.
 */
export async function POST(req: Request): Promise<Response> {
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    // some engines send no/odd bodies — still ack
  }
  const report =
    body && typeof body === "object" && "csp-report" in (body as Record<string, unknown>)
      ? (body as Record<string, unknown>)["csp-report"]
      : body;
  const r = (report ?? {}) as Record<string, unknown>;
  const directive = String(r["violated-directive"] ?? r["effectiveDirective"] ?? "unknown");
  const blocked = String(r["blocked-uri"] ?? r["blockedURL"] ?? "unknown");
  const documentUri = String(r["document-uri"] ?? r["documentURL"] ?? "unknown");

  console.warn("[web-admin] csp.violation", { directive, blocked, documentUri });
  Sentry.captureMessage(`csp-violation:${directive}`, {
    level: "warning",
    tags: { directive },
    extra: { blocked, documentUri },
  });
  return new Response(null, { status: 204 });
}
