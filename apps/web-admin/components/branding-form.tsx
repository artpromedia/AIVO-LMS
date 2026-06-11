"use client";

/**
 * White-label branding editor (Sprint B6) — shared by the platform
 * per-tenant page and the district self-serve page. Colors are checked
 * LIVE against @aivo/brand's contrast guard (the same checks the write
 * route enforces), so an admin sees "primary on dark chrome fails:
 * 2.7:1 (needs 3:1)" before ever hitting save. Logos are read client-side
 * into a data URL (server re-validates type/size/dimensions).
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { evaluateBrandPalette } from "@aivo/brand";

export interface BrandingValues {
  displayName: string;
  primaryColor: string;
  secondaryColor: string;
  supportUrl: string;
  logoUrl: string | null;
}

const MAX_LOGO_BYTES = 200 * 1024;

export function BrandingForm({
  initial,
  saveEndpoint,
  logoEndpoint,
}: {
  initial: BrandingValues;
  /** POST target persisting colors/supportUrl/displayName (and reset). */
  saveEndpoint: string;
  /** POST target for the validated logo upload. */
  logoEndpoint: string;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [primaryColor, setPrimaryColor] = useState(initial.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(initial.secondaryColor);
  const [supportUrl, setSupportUrl] = useState(initial.supportUrl);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const verdict = useMemo(
    () =>
      evaluateBrandPalette({
        primaryColor: primaryColor || null,
        secondaryColor: secondaryColor || null,
      }),
    [primaryColor, secondaryColor],
  );

  const previewLogo = logoDataUrl ?? initial.logoUrl;
  const previewPrimary = verdict.ok && primaryColor ? primaryColor : "#7C3AED";

  async function onLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    setLogoError(null);
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError("Logo exceeds the 200KB limit.");
      return;
    }
    if (file.type !== "image/png" && file.type !== "image/svg+xml") {
      setLogoError("Logo must be a PNG or SVG file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (logoDataUrl) {
        const logoRes = await fetch(logoEndpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ logo: logoDataUrl }),
        });
        if (!logoRes.ok) {
          const body = (await logoRes.json().catch(() => ({}))) as { error?: string };
          setServerError(body.error ?? "Logo upload failed.");
          return;
        }
      }
      const res = await fetch(saveEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim() || null,
          primaryColor: primaryColor.trim() || null,
          secondaryColor: secondaryColor.trim() || null,
          supportUrl: supportUrl.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setServerError(body.error ?? "Branding could not be saved.");
        return;
      }
      setNotice("Branding saved. Signed-in users see it within five minutes.");
      setLogoDataUrl(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setServerError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch(saveEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: null,
          primaryColor: null,
          secondaryColor: null,
          supportUrl: null,
          resetLogo: true,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setServerError(body.error ?? "Reset failed.");
        return;
      }
      setDisplayName("");
      setPrimaryColor("");
      setSecondaryColor("");
      setSupportUrl("");
      setLogoDataUrl(null);
      setNotice("Branding reset to AIVO defaults.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]" onSubmit={submit} data-testid="branding-form">
      <div className="admin-card p-6">
        {serverError ? <p className="admin-error mb-4" data-testid="branding-error">{serverError}</p> : null}
        {notice ? <p className="admin-notice mb-4" data-testid="branding-notice">{notice}</p> : null}

        <label className="block text-sm font-semibold text-slate-600">
          Display name
          <input
            className="admin-input"
            type="text"
            value={displayName}
            maxLength={120}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Lincoln Public Schools"
          />
        </label>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-600">
            Primary color
            <div className="flex items-center gap-2">
              <input
                className="admin-input"
                type="text"
                value={primaryColor}
                onChange={(event) => setPrimaryColor(event.target.value)}
                placeholder="#0F766E"
                data-testid="branding-primary"
              />
              <input
                aria-label="Primary color picker"
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(primaryColor) ? primaryColor : "#7C3AED"}
                onChange={(event) => setPrimaryColor(event.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-slate-300"
              />
            </div>
          </label>
          <label className="block text-sm font-semibold text-slate-600">
            Secondary color
            <div className="flex items-center gap-2">
              <input
                className="admin-input"
                type="text"
                value={secondaryColor}
                onChange={(event) => setSecondaryColor(event.target.value)}
                placeholder="#C2410C"
                data-testid="branding-secondary"
              />
              <input
                aria-label="Secondary color picker"
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(secondaryColor) ? secondaryColor : "#C2410C"}
                onChange={(event) => setSecondaryColor(event.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-slate-300"
              />
            </div>
          </label>
        </div>

        {(primaryColor || secondaryColor) && (
          <ul className="mt-3 space-y-1 text-sm" data-testid="contrast-verdicts">
            {verdict.checks.map((check) => (
              <li
                key={`${check.slot}-${check.context}`}
                className={check.passed ? "text-green-700" : "font-semibold text-red-700"}
              >
                {check.passed ? "✓" : "✗"} {check.message}
              </li>
            ))}
          </ul>
        )}

        <label className="mt-4 block text-sm font-semibold text-slate-600">
          Support link
          <input
            className="admin-input"
            type="url"
            value={supportUrl}
            onChange={(event) => setSupportUrl(event.target.value)}
            placeholder="https://help.district.org"
          />
        </label>

        <label className="mt-4 block text-sm font-semibold text-slate-600">
          Logo (PNG or SVG, ≥512×128, ≤200KB)
          <input
            className="mt-1 block text-sm"
            type="file"
            accept="image/png,image/svg+xml"
            onChange={onLogoChange}
            data-testid="branding-logo-input"
          />
        </label>
        {logoError ? <p className="admin-error mt-2">{logoError}</p> : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button className="admin-button" type="submit" disabled={busy || !verdict.ok} data-testid="branding-save">
            Save branding
          </button>
          <button
            className="admin-button-secondary"
            type="button"
            onClick={reset}
            disabled={busy}
            data-testid="branding-reset"
          >
            Reset to AIVO defaults
          </button>
          {!verdict.ok ? (
            <span className="text-sm font-semibold text-red-700">
              Fix the contrast failures above to save.
            </span>
          ) : null}
        </div>
      </div>

      <aside className="admin-card h-fit p-6" data-testid="branding-preview" aria-label="Branding preview">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Preview</h3>
        <div className="mt-3 rounded-lg border border-slate-200 p-4">
          {previewLogo ? (
              <img src={previewLogo} alt="Logo preview" className="h-9 w-auto" />
          ) : (
            <span className="text-lg font-black text-slate-800">AIVO</span>
          )}
          <p className="mt-2 text-sm font-semibold text-slate-700">
            {displayName || "Your district"}
          </p>
          <button
            type="button"
            className="mt-3 rounded-full px-4 py-2 text-sm font-bold text-white"
            style={{ backgroundColor: previewPrimary }}
            tabIndex={-1}
          >
            Primary action
          </button>
          <p className="mt-3 text-xs text-slate-500">
            Header logo + accent colors apply to parent, teacher, and admin
            surfaces after sign-in. Learner sensory palettes are never
            overridden.
          </p>
        </div>
      </aside>
    </form>
  );
}
