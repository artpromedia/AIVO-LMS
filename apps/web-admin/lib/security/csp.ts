/**
 * Content-Security-Policy builder (Sprint A3, ZAP #65/#73).
 *
 * Nonce-based script policy following the official Next.js CSP guide:
 * middleware generates a nonce per request, passes it to Next via the
 * `x-nonce` request header (Next nonces its own inline scripts from the
 * CSP request header), and sets the response policy here.
 *
 * Documented allowances:
 *  - style-src 'unsafe-inline': React inline `style=` attributes are used
 *    across the learner surfaces (sensory palettes set CSS vars inline) and
 *    KaTeX renders with inline styles. Styles cannot execute script; the
 *    XSS-relevant directive (script-src) stays strict.
 *  - script-src adds 'unsafe-eval' + 'unsafe-inline' ONLY outside
 *    production (next dev / HMR need them). Production is nonce +
 *    strict-dynamic.
 *  - connect-src adds the Sentry ingest origin when a DSN is configured
 *    (Sprint A2 telemetry), and ws:/wss: outside production for HMR.
 *  - img-src allows https: + data: + blob: — lesson media and avatars are
 *    served from tenant-configurable origins; image loads cannot run
 *    script and tightening to an origin list is tracked for the asset-CDN
 *    consolidation.
 */

export interface CspInput {
  nonce: string;
  isProd: boolean;
  /** Full DSN (or undefined) — only its origin is allowlisted. */
  sentryDsn?: string;
  /** Where violation reports POST to. */
  reportPath: string;
}

export function sentryOriginFromDsn(dsn: string | undefined): string | null {
  if (!dsn) return null;
  try {
    return new URL(dsn).origin;
  } catch {
    return null;
  }
}

export function buildCsp({ nonce, isProd, sentryDsn, reportPath }: CspInput): string {
  const sentryOrigin = sentryOriginFromDsn(sentryDsn);
  const scriptSrc = isProd
    ? `'self' 'nonce-${nonce}' 'strict-dynamic'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval' 'unsafe-inline'`;
  const connectSrc = ["'self'", sentryOrigin, isProd ? null : "ws:", isProd ? null : "wss:"]
    .filter(Boolean)
    .join(" ");
  return [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' https: data: blob:`,
    `font-src 'self' data:`,
    `connect-src ${connectSrc}`,
    `media-src 'self' blob: data:`,
    `worker-src 'self' blob:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `report-uri ${reportPath}`,
  ].join("; ");
}

export function makeNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
