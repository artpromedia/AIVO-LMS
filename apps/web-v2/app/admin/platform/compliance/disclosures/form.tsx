"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const RECIPIENT_TYPES = [
  "school_official",
  "auditor",
  "law_enforcement",
  "parent",
  "court_order",
  "ferpa_directory",
  "other",
] as const;

export function DisclosureForm() {
  const router = useRouter();
  const [recipientType, setRecipientType] =
    useState<(typeof RECIPIENT_TYPES)[number]>("school_official");
  const [recipientName, setRecipientName] = useState("");
  const [reason, setReason] = useState("");
  const [ferpaBasis, setFerpaBasis] = useState("school_official_exception");
  const [learnerId, setLearnerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/bff/admin/compliance/disclosures", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          recipientType,
          recipientName,
          reason,
          ferpaBasis,
          learnerId: learnerId || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Failed.");
      setRecipientName("");
      setReason("");
      setLearnerId("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-2">
      <div>
        <label className="block text-sm font-medium" htmlFor="rtype">
          Recipient type
        </label>
        <select
          id="rtype"
          className="mt-1 w-full rounded border border-aivo-border bg-aivo-surface-1 p-2"
          value={recipientType}
          onChange={(e) =>
            setRecipientType(e.target.value as (typeof RECIPIENT_TYPES)[number])
          }
        >
          {RECIPIENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium" htmlFor="rname">
          Recipient name
        </label>
        <input
          id="rname"
          className="mt-1 w-full rounded border border-aivo-border bg-aivo-surface-1 p-2"
          required
          maxLength={200}
          value={recipientName}
          onChange={(e) => setRecipientName(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-sm font-medium" htmlFor="fbasis">
          FERPA basis
        </label>
        <input
          id="fbasis"
          className="mt-1 w-full rounded border border-aivo-border bg-aivo-surface-1 p-2"
          required
          maxLength={200}
          value={ferpaBasis}
          onChange={(e) => setFerpaBasis(e.target.value)}
          placeholder="school_official_exception"
        />
      </div>
      <div>
        <label className="block text-sm font-medium" htmlFor="lid">
          Learner ID (optional)
        </label>
        <input
          id="lid"
          className="mt-1 w-full rounded border border-aivo-border bg-aivo-surface-1 p-2"
          maxLength={64}
          value={learnerId}
          onChange={(e) => setLearnerId(e.target.value)}
        />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-sm font-medium" htmlFor="reason">
          Reason
        </label>
        <textarea
          id="reason"
          className="mt-1 w-full rounded border border-aivo-border bg-aivo-surface-1 p-2"
          rows={2}
          required
          maxLength={2000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Record disclosure"}
        </Button>
      </div>
    </form>
  );
}
