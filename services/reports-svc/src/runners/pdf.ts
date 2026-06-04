/**
 * PDF rendering (Sprint 10).
 *
 * Production renders the branded HTML template (templates/report.html) to PDF
 * with Playwright in a separate worker pod, applying the tenant logo + colors
 * fetched from tenant-svc. In environments without a browser (CI unit tests,
 * dev), we return the rendered HTML bytes so the pipeline stays exercised and
 * the run still completes; `contentType` reflects what was actually produced.
 *
 * The Playwright path is loaded dynamically so the dependency stays optional.
 */
import type { ReportColumn } from "../registry/types.js";

export interface Branding {
  tenantName?: string;
  logoUrl?: string;
  primaryColor?: string;
}

export function renderReportHtml(
  title: string,
  columns: ReportColumn[],
  rows: Array<Record<string, unknown>>,
  branding: Branding = {},
): string {
  const accent = branding.primaryColor ?? "#4f46e5";
  const head = columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("");
  const body = rows
    .map(
      (r) =>
        `<tr>${columns.map((c) => `<td>${escapeHtml(String(r[c.key] ?? ""))}</td>`).join("")}</tr>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:system-ui,sans-serif;color:#111;margin:32px}
    header{display:flex;align-items:center;gap:12px;border-bottom:3px solid ${accent};padding-bottom:12px}
    h1{font-size:20px;margin:0}
    table{width:100%;border-collapse:collapse;margin-top:16px;font-size:12px}
    th{background:${accent};color:#fff;text-align:left;padding:6px 8px}
    td{padding:6px 8px;border-bottom:1px solid #eee}
    .meta{color:#666;font-size:11px;margin-top:4px}
  </style></head><body>
    <header>
      ${branding.logoUrl ? `<img src="${escapeHtml(branding.logoUrl)}" height="32" alt="logo">` : ""}
      <div><h1>${escapeHtml(title)}</h1>
      <div class="meta">${escapeHtml(branding.tenantName ?? "AIVO")} · generated ${new Date().toISOString()}</div></div>
    </header>
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
  </body></html>`;
}

export interface PdfResult {
  buffer: Buffer;
  /** application/pdf when Playwright rendered, else text/html. */
  contentType: string;
}

export async function renderReportPdf(
  title: string,
  columns: ReportColumn[],
  rows: Array<Record<string, unknown>>,
  branding: Branding = {},
): Promise<PdfResult> {
  const html = renderReportHtml(title, columns, rows, branding);
  try {
    // Variable specifier keeps `playwright` an optional runtime dep (not a
    // build-time dependency of reports-svc — it lives in the PDF worker pod).
    const playwrightModule = "playwright";
    const mod = (await import(playwrightModule)) as unknown as {
      chromium?: { launch: () => Promise<any> };
    };
    if (mod.chromium) {
      const browser = await mod.chromium.launch();
      try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: "load" });
        const buffer: Buffer = await page.pdf({ format: "A4", printBackground: true });
        return { buffer, contentType: "application/pdf" };
      } finally {
        await browser.close();
      }
    }
  } catch {
    // Playwright unavailable → fall back to HTML bytes.
  }
  return { buffer: Buffer.from(html, "utf8"), contentType: "text/html; charset=utf-8" };
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
