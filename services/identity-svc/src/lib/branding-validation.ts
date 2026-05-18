/**
 * Sprint 9 — district branding validators.
 *
 * Two helpers:
 *  - `parseLogoDataUrl` decodes a base64 data URL, enforces type
 *    (PNG or SVG), size (≤ 200KB), and minimum pixel dimensions
 *    (512×128). PNG dimensions are read from the IHDR chunk so we
 *    don't pull in image-magick. SVG is parsed via a tiny string
 *    extractor for `viewBox` / `width` / `height`.
 *  - `wcagContrastRatio` computes the WCAG 2.1 contrast ratio between
 *    a hex color and white background — branding primaryColor must
 *    achieve ≥ 4.5 (AA for normal text) so the UI never produces
 *    inaccessible chrome.
 */

const MAX_LOGO_BYTES = 200 * 1024;
const MIN_LOGO_W = 512;
const MIN_LOGO_H = 128;

export interface LogoCheck {
  ok: boolean;
  error?: string;
  mime?: "image/png" | "image/svg+xml";
  bytes?: number;
  width?: number;
  height?: number;
}

export function parseLogoDataUrl(dataUrl: string): LogoCheck {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    return { ok: false, error: "Logo must be provided as a data: URL" };
  }
  const m = dataUrl.match(/^data:([\w/+\-.]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return { ok: false, error: "Logo must be base64-encoded data URL" };
  const mime = m[1].toLowerCase();
  if (mime !== "image/png" && mime !== "image/svg+xml") {
    return { ok: false, error: "Logo must be PNG or SVG" };
  }
  let buf: Buffer;
  try {
    buf = Buffer.from(m[2], "base64");
  } catch {
    return { ok: false, error: "Invalid base64 payload" };
  }
  if (buf.length > MAX_LOGO_BYTES) {
    return {
      ok: false,
      error: `Logo exceeds the 200KB size limit (got ${(buf.length / 1024).toFixed(0)}KB)`,
    };
  }
  if (mime === "image/png") {
    const dims = readPngDimensions(buf);
    if (!dims) return { ok: false, error: "Could not read PNG dimensions" };
    if (dims.w < MIN_LOGO_W || dims.h < MIN_LOGO_H) {
      return {
        ok: false,
        error: `Logo must be at least ${MIN_LOGO_W}×${MIN_LOGO_H} pixels (got ${dims.w}×${dims.h})`,
      };
    }
    return { ok: true, mime: "image/png", bytes: buf.length, width: dims.w, height: dims.h };
  }
  // SVG
  const dims = readSvgDimensions(buf.toString("utf8"));
  if (!dims) return { ok: false, error: "SVG must declare width/height or viewBox" };
  if (dims.w < MIN_LOGO_W || dims.h < MIN_LOGO_H) {
    return {
      ok: false,
      error: `Logo must be at least ${MIN_LOGO_W}×${MIN_LOGO_H} (got ${dims.w}×${dims.h})`,
    };
  }
  return { ok: true, mime: "image/svg+xml", bytes: buf.length, width: dims.w, height: dims.h };
}

function readPngDimensions(buf: Buffer): { w: number; h: number } | null {
  // PNG signature is 8 bytes; IHDR chunk follows starting at byte 8 with
  // length(4) + "IHDR"(4) + width(4 BE) + height(4 BE).
  if (buf.length < 24) return null;
  const sig = buf.subarray(0, 8).toString("hex");
  if (sig !== "89504e470d0a1a0a") return null;
  if (buf.subarray(12, 16).toString("ascii") !== "IHDR") return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function readSvgDimensions(svg: string): { w: number; h: number } | null {
  // viewBox="x y w h" wins over width/height attributes.
  const vb = svg.match(/viewBox\s*=\s*"([\d.\s\-]+)"/i);
  if (vb) {
    const parts = vb[1].trim().split(/\s+/).map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      return { w: Math.round(parts[2]), h: Math.round(parts[3]) };
    }
  }
  const w = svg.match(/\bwidth\s*=\s*"(\d+(?:\.\d+)?)(?:px)?"/i);
  const h = svg.match(/\bheight\s*=\s*"(\d+(?:\.\d+)?)(?:px)?"/i);
  if (w && h) return { w: Math.round(Number(w[1])), h: Math.round(Number(h[1])) };
  return null;
}

// --- WCAG contrast ----------------------------------------------------

export function wcagContrastRatio(fgHex: string, bgHex = "#FFFFFF"): number | null {
  const fg = hexToRgb(fgHex);
  const bg = hexToRgb(bgHex);
  if (!fg || !bg) return null;
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [a, b] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (a + 0.05) / (b + 0.05);
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export const WCAG_AA_NORMAL = 4.5;
