"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TenantBranding } from "@/lib/db/types";

/** WCAG-AA contrast helper: returns the ratio between a hex colour and white. */
function contrastWithWhite(hex: string): number | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return null;
  const [r, g, b] = [
    parseInt(m[1].slice(0, 2), 16),
    parseInt(m[1].slice(2, 4), 16),
    parseInt(m[1].slice(4, 6), 16),
  ];
  const toLin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
  return (1 + 0.05) / (L + 0.05);
}

export function BrandingForm({
  initial,
  fallbackName,
}: {
  initial: TenantBranding;
  fallbackName: string;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initial.displayName ?? fallbackName);
  const [supportEmail, setSupportEmail] = useState(initial.supportEmail ?? "");
  const [primaryColor, setPrimaryColor] = useState(initial.primaryColor ?? "#2D5BFF");
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<
    { kind: "ok"; msg: string } | { kind: "err"; msg: string } | null
  >(null);

  const ratio = contrastWithWhite(primaryColor);
  const contrastBadge = ratio
    ? ratio >= 4.5
      ? { tone: "ok" as const, label: `Contrast ${ratio.toFixed(1)} : 1 — AA pass` }
      : ratio >= 3
        ? { tone: "warn" as const, label: `Contrast ${ratio.toFixed(1)} : 1 — large text only` }
        : { tone: "err" as const, label: `Contrast ${ratio.toFixed(1)} : 1 — fails WCAG AA` }
    : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/bff/admin/district/settings", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            branding: {
              displayName: displayName.trim() || null,
              supportEmail: supportEmail.trim() || null,
              primaryColor,
            },
          }),
        });
        const json = await res.json();
        if (!json.ok) {
          setStatus({
            kind: "err",
            msg: json.error?.userMessage ?? "Could not save changes.",
          });
          return;
        }
        setStatus({ kind: "ok", msg: "Branding saved." });
        router.refresh();
      } catch {
        setStatus({ kind: "err", msg: "Network error — please try again." });
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <Label htmlFor="displayName">Display name</Label>
        <Input
          id="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={120}
          className="mt-1"
        />
        <p className="mt-1 text-xs text-aivo-ink-soft">
          Shown in the product header, emails, and parent portal.
        </p>
      </div>

      <div>
        <Label htmlFor="supportEmail">Support email</Label>
        <Input
          id="supportEmail"
          type="email"
          value={supportEmail}
          onChange={(e) => setSupportEmail(e.target.value)}
          maxLength={254}
          placeholder="support@district.org"
          className="mt-1"
        />
        <p className="mt-1 text-xs text-aivo-ink-soft">
          Families and staff in this district see this on every help page.
        </p>
      </div>

      <div>
        <Label htmlFor="primaryColor">Primary brand colour</Label>
        <div className="mt-1 flex items-center gap-3">
          <input
            id="primaryColor"
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded border border-aivo-border bg-transparent p-0"
            aria-label="Primary brand colour"
          />
          <Input
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="font-mono uppercase"
            maxLength={7}
            pattern="^#[0-9a-fA-F]{6}$"
          />
          <span
            aria-hidden
            className="inline-flex h-10 items-center rounded-md px-3 text-sm font-semibold text-white"
            style={{ background: primaryColor }}
          >
            Sample
          </span>
        </div>
        {contrastBadge ? (
          <p
            className={`mt-2 text-xs ${
              contrastBadge.tone === "ok"
                ? "text-aivo-success"
                : contrastBadge.tone === "warn"
                  ? "text-amber-600"
                  : "text-aivo-danger"
            }`}
          >
            {contrastBadge.label}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-3">
        {status?.kind === "ok" ? <p className="text-sm text-aivo-success">{status.msg}</p> : null}
        {status?.kind === "err" ? <p className="text-sm text-aivo-danger">{status.msg}</p> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save branding"}
        </Button>
      </div>
    </form>
  );
}
