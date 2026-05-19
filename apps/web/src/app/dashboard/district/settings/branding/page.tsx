"use client";
/**
 * Sprint 9 — district branding settings.
 *
 * Lets a district admin set their organization's display name, support
 * email, primary color, and logo. Color picker enforces WCAG AA contrast
 * against white background (the chrome where the color is consumed) and
 * shows the computed ratio live; logo uploader enforces PNG/SVG ≤ 200KB
 * and ≥ 512×128 client-side before sending base64 to the backend.
 *
 * Live preview composes the same chrome shown in the parent + learner
 * portals so the admin can see exactly what their families will see.
 */
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useMemo, useState, useRef } from "react";
import { Palette, Upload, Save, AlertCircle, CheckCircle2 } from "lucide-react";

interface Branding {
  displayName?: string;
  supportEmail?: string;
  primaryColor?: string;
  logoUrl?: string;
  logoMime?: string;
  logoBytes?: number;
}

const MIN_W = 512,
  MIN_H = 128,
  MAX_BYTES = 200 * 1024;

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

function contrastRatio(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
  // White background = luminance 1.
  return (1 + 0.05) / (lum + 0.05);
}

export default function DistrictBrandingPage() {
  const { accessToken } = useAuth();
  const [branding, setBranding] = useState<Branding>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!accessToken) return;
    fetch("/api/district/settings", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (s?.branding) setBranding(s.branding);
      })
      .finally(() => setLoading(false));
  }, [accessToken]);

  const ratio = useMemo(
    () => (branding.primaryColor ? contrastRatio(branding.primaryColor) : null),
    [branding.primaryColor],
  );
  const ratioOk = ratio === null ? true : ratio >= 4.5;

  async function saveText() {
    if (!accessToken) return;
    setMsg(null);
    setSaving(true);
    try {
      const res = await fetch("/api/district/settings", {
        method: "PUT",
        headers: { "content-type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          branding: {
            displayName: branding.displayName?.trim() || undefined,
            supportEmail: branding.supportEmail?.trim() || undefined,
            primaryColor: branding.primaryColor?.trim() || undefined,
          },
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ type: "error", text: body.error || "Failed to save" });
        return;
      }
      setMsg({ type: "ok", text: "Branding saved." });
      if (body.branding) setBranding(body.branding);
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(file: File) {
    if (!accessToken) return;
    setMsg(null);
    if (file.size > MAX_BYTES) {
      setMsg({ type: "error", text: `Logo exceeds 200KB (got ${Math.round(file.size / 1024)}KB)` });
      return;
    }
    if (!["image/png", "image/svg+xml"].includes(file.type)) {
      setMsg({ type: "error", text: "Logo must be PNG or SVG" });
      return;
    }
    // Client-side dimension check for PNG; skip for SVG (server will check).
    if (file.type === "image/png") {
      const ok = await new Promise<boolean>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img.width >= MIN_W && img.height >= MIN_H);
        img.onerror = () => resolve(false);
        img.src = URL.createObjectURL(file);
      });
      if (!ok) {
        setMsg({ type: "error", text: `PNG must be at least ${MIN_W}×${MIN_H}` });
        return;
      }
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(file);
    });
    setLogoBusy(true);
    try {
      const res = await fetch("/api/district/settings/branding/logo", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ dataUrl }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ type: "error", text: body.error || "Upload failed" });
        return;
      }
      setBranding(body.branding || {});
      setMsg({ type: "ok", text: "Logo updated." });
    } finally {
      setLogoBusy(false);
    }
  }

  if (loading)
    return (
      <div className="p-8 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-48" />
      </div>
    );

  return (
    <div className="p-8 space-y-6 max-w-5xl">
      <header className="flex items-center gap-4">
        <div className="vi-icon-well bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] p-3 rounded-2xl">
          <Palette size={28} strokeWidth={2.5} aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-bold vi-text">Branding</h1>
          <p className="text-sm vi-text-muted mt-1">
            Customize how your district appears to families and learners.
          </p>
        </div>
      </header>

      {msg && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${msg.type === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}
        >
          {msg.type === "ok" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{msg.text}</span>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="vi-card p-6 space-y-4">
          <h2 className="text-lg font-heading font-semibold vi-text">Identity</h2>
          <label className="block">
            <span className="text-xs font-semibold vi-text-muted uppercase tracking-wide">
              Display Name
            </span>
            <input
              type="text"
              maxLength={120}
              value={branding.displayName || ""}
              onChange={(e) => setBranding({ ...branding, displayName: e.target.value })}
              className="mt-1 w-full rounded-lg border vi-border px-3 py-2 vi-bg vi-text"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold vi-text-muted uppercase tracking-wide">
              Support Email
            </span>
            <input
              type="email"
              value={branding.supportEmail || ""}
              onChange={(e) => setBranding({ ...branding, supportEmail: e.target.value })}
              className="mt-1 w-full rounded-lg border vi-border px-3 py-2 vi-bg vi-text"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold vi-text-muted uppercase tracking-wide">
              Primary Color
            </span>
            <div className="mt-1 flex items-center gap-3">
              <input
                type="color"
                // eslint-disable-next-line no-restricted-syntax -- district admin chooses tenant brand color; default is product brand mark, not a tier surface
                value={branding.primaryColor || "#7c3aed"}
                onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                className="h-10 w-16 rounded-lg border vi-border"
              />
              <input
                type="text"
                value={branding.primaryColor || ""}
                // eslint-disable-next-line no-restricted-syntax -- placeholder hex example for district brand color input
                placeholder="#7C3AED"
                onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                className="flex-1 rounded-lg border vi-border px-3 py-2 vi-bg vi-text font-mono text-sm"
              />
            </div>
            {ratio !== null && (
              <p className={`mt-1 text-xs ${ratioOk ? "text-emerald-700" : "text-rose-700"}`}>
                Contrast on white: {ratio.toFixed(2)}:1 {ratioOk ? "✓ WCAG AA" : "✗ needs ≥ 4.5:1"}
              </p>
            )}
          </label>
          <button
            onClick={saveText}
            disabled={saving || !ratioOk}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[hsl(var(--visual-primary))] text-white text-sm font-semibold disabled:opacity-50"
          >
            <Save size={16} /> {saving ? "Saving…" : "Save"}
          </button>
        </div>

        <div className="vi-card p-6 space-y-4">
          <h2 className="text-lg font-heading font-semibold vi-text">Logo</h2>
          <p className="text-xs vi-text-muted">
            PNG or SVG, ≤ 200KB, at least 512×128. Stored inline as a data URL (no external CDN in
            this environment).
          </p>
          {branding.logoUrl ? (
            <div className="rounded-xl border vi-border bg-slate-50 p-4 flex items-center justify-center min-h-32">
              <img src={branding.logoUrl} alt="District logo" className="max-h-24 max-w-full" />
            </div>
          ) : (
            <div className="rounded-xl border vi-border vi-surface-soft p-4 text-center text-sm vi-text-muted">
              No logo uploaded yet.
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadLogo(f);
              e.currentTarget.value = "";
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={logoBusy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border vi-border vi-text text-sm font-semibold disabled:opacity-50"
          >
            <Upload size={16} /> {logoBusy ? "Uploading…" : "Upload Logo"}
          </button>
        </div>
      </div>

      <div className="vi-card p-6 space-y-4">
        <h2 className="text-lg font-heading font-semibold vi-text">Live Preview</h2>
        <div className="rounded-2xl border vi-border overflow-hidden">
          <div
            className="flex items-center gap-3 px-5 py-3 text-white"
            // eslint-disable-next-line no-restricted-syntax -- live preview of tenant brand color (district admin's own choice), defaults to product brand mark
            style={{ backgroundColor: branding.primaryColor || "#7c3aed" }}
          >
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt="" className="h-8 max-w-32 object-contain" />
            ) : (
              <span className="font-heading font-bold text-base">AIVO</span>
            )}
            <span className="font-heading font-semibold">
              {branding.displayName || "Your District"}
            </span>
          </div>
          <div className="p-5 vi-bg">
            <p className="text-sm vi-text">
              Welcome back! This is what families and learners see at the top of their portal.
            </p>
            {branding.supportEmail && (
              <p className="text-xs vi-text-muted mt-2">
                Support:{" "}
                <a className="underline" href={`mailto:${branding.supportEmail}`}>
                  {branding.supportEmail}
                </a>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
