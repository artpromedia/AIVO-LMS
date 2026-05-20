"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const FRAMEWORK_OPTIONS = [
  { value: "common-core-math", label: "Common Core Math" },
  { value: "common-core-ela", label: "Common Core ELA" },
  { value: "ngss-science", label: "NGSS Science" },
  { value: "state-placeholder", label: "State (placeholder)" },
  { value: "aivo-extensions", label: "AIVO Extensions" },
] as const;

export function ImportForm() {
  const router = useRouter();
  const [frameworkSlug, setFrameworkSlug] = useState<string>("common-core-math");
  const [source, setSource] = useState("manual");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/bff/curriculum/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ frameworkSlug, source }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json?.error?.message ?? "Import failed.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm">
        Framework
        <select
          value={frameworkSlug}
          onChange={(e) => setFrameworkSlug(e.target.value)}
          className="mt-1 block w-full rounded border px-2 py-1"
        >
          {FRAMEWORK_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Source
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="mt-1 block w-full rounded border px-2 py-1"
          placeholder="manual, s3://…, https://…"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" size="sm" disabled={busy}>
        {busy ? "Starting…" : "Start import"}
      </Button>
    </form>
  );
}
