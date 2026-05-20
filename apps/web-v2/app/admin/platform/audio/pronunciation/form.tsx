"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CreateOverrideForm({ canPublishPlatform }: { canPublishPlatform: boolean }) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [replacement, setReplacement] = useState("");
  const [encoding, setEncoding] = useState<"ipa" | "x-sampa" | "plain">("plain");
  const [scope, setScope] = useState<"platform" | "tenant">("tenant");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/bff/admin/audio/pronunciation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, replacement, encoding, scope, notes: notes || null }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? "Failed.");
      setToken("");
      setReplacement("");
      setNotes("");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">
        Token
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="mt-1 w-full rounded border px-2 py-1"
          placeholder="e.g. AIVO"
        />
      </label>
      <label className="text-sm">
        Replacement
        <input
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
          className="mt-1 w-full rounded border px-2 py-1"
          placeholder="e.g. ay-voh"
        />
      </label>
      <label className="text-sm">
        Encoding
        <select
          value={encoding}
          onChange={(e) => setEncoding(e.target.value as typeof encoding)}
          className="mt-1 w-full rounded border px-2 py-1"
        >
          <option value="plain">plain</option>
          <option value="ipa">ipa</option>
          <option value="x-sampa">x-sampa</option>
        </select>
      </label>
      <label className="text-sm">
        Scope
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as typeof scope)}
          className="mt-1 w-full rounded border px-2 py-1"
        >
          <option value="tenant">tenant</option>
          {canPublishPlatform && <option value="platform">platform</option>}
        </select>
      </label>
      <label className="text-sm sm:col-span-2">
        Notes (optional)
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 w-full rounded border px-2 py-1"
        />
      </label>
      <div className="sm:col-span-2 flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={submit}
          disabled={busy || !token.trim() || !replacement.trim()}
        >
          Add override
        </Button>
        {err && <span className="text-xs text-red-600">{err}</span>}
      </div>
    </div>
  );
}
