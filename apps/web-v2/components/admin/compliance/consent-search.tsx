"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ConsentRecord } from "@/lib/compliance/governance-store";

type SearchResult = ConsentRecord[];

export function ConsentSearch() {
  const [subjectId, setSubjectId] = useState("");
  const [consentType, setConsentType] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function search() {
    setError(null);
    start(async () => {
      const params = new URLSearchParams();
      if (subjectId.trim()) params.set("subjectId", subjectId.trim());
      if (consentType.trim()) params.set("consentType", consentType.trim());
      const res = await fetch(`/api/bff/admin/compliance/consent?${params.toString()}`);
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error?.message ?? "Search failed.");
        return;
      }
      setResults(body.data.records as SearchResult);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-aivo-ink-soft" htmlFor="cs-subject">
            Subject ID
          </label>
          <Input
            id="cs-subject"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            placeholder="lrn_demo_sky"
            className="w-56"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-aivo-ink-soft" htmlFor="cs-type">
            Consent type
          </label>
          <Input
            id="cs-type"
            value={consentType}
            onChange={(e) => setConsentType(e.target.value)}
            placeholder="child_data_collection"
            className="w-56"
          />
        </div>
        <Button size="sm" onClick={search} disabled={pending}>
          {pending ? "Searching…" : "Search"}
        </Button>
      </div>

      {error && <p className="text-sm text-aivo-danger">{error}</p>}

      {results !== null &&
        (results.length === 0 ? (
          <p className="text-sm text-aivo-ink-soft">No consent records found.</p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-aivo-border">
            <table className="w-full text-sm">
              <thead className="bg-iw-raised text-left">
                <tr>
                  <th className="p-3 font-semibold">Subject</th>
                  <th className="p-3 font-semibold">Type</th>
                  <th className="p-3 font-semibold">Granted</th>
                  <th className="p-3 font-semibold">Method</th>
                  <th className="p-3 font-semibold">Actor</th>
                  <th className="p-3 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id} className="border-t border-aivo-border">
                    <td className="p-3 font-mono text-xs">{r.subjectId}</td>
                    <td className="p-3 text-xs">{r.consentType}</td>
                    <td className="p-3">
                      <Badge tone={r.granted ? "success" : "danger"}>
                        {r.granted ? "Yes" : "No"}
                      </Badge>
                    </td>
                    <td className="p-3 text-xs text-aivo-ink-soft">{r.method ?? "—"}</td>
                    <td className="p-3 text-xs text-aivo-ink-soft">{r.actorRole ?? "—"}</td>
                    <td className="p-3 text-xs text-aivo-ink-soft">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
}
