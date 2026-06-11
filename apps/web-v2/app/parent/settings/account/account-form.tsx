"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AccountForm({
  initial,
}: {
  initial: { displayName: string; timezone?: string | null };
}) {
  const t = useTranslations("parent.settings_account_form");
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initial.displayName);
  // Sprint A8 — viewer timezone. Options come from the browser's own IANA
  // database; the stored value is validated server-side too.
  const [timezone, setTimezone] = useState(
    initial.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const timezones: string[] =
    typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [timezone];
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await fetch("/api/bff/account", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error?.userMessage ?? "Could not save changes.");
        return;
      }
      // Explicit choice: source:"user" — the auto-detector never overrides it.
      const tzRes = await fetch("/api/bff/me/timezone", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ timezone, source: "user" }),
      });
      const tzJson = await tzRes.json().catch(() => ({ ok: false }));
      if (!tzJson.ok) {
        setError(tzJson.error?.userMessage ?? "Could not save the timezone.");
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium" htmlFor="displayName">
          {t("display_name")}
        </label>
        <Input
          id="displayName"
          name="displayName"
          value={displayName}
          maxLength={120}
          onChange={(e) => setDisplayName(e.target.value)}
          className="mt-1"
        />
      </div>
      <div>
        <label className="block text-sm font-medium" htmlFor="timezone">
          {t("timezone")}
        </label>
        <select
          id="timezone"
          name="timezone"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="mt-1 h-11 w-full rounded-iw-control border border-iw-border bg-iw-raised px-3 text-sm text-iw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring"
        >
          {timezones.map((zone) => (
            <option key={zone} value={zone}>
              {zone.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-iw-ink-muted">{t("timezone_hint")}</p>
      </div>
      {error ? <p className="text-sm text-aivo-danger">{error}</p> : null}
      {saved ? <p className="text-sm text-aivo-success">{t("saved")}</p> : null}
      <Button type="submit" disabled={pending || displayName.trim().length === 0}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
