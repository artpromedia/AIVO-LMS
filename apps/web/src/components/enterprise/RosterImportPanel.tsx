"use client";

import { useState } from "react";

export interface RosterImportSummary {
  jobId: string;
  schoolsCreated: number;
  classesUpserted: number;
  enrollmentsUpserted: number;
  teachersAssigned: number;
  studentsAdded: number;
  warnings: string[];
  preservedParentOwnedFields: boolean;
}

export interface RosterImportPanelProps {
  districtId: string;
  fetchImpl?: typeof fetch;
}

export function RosterImportPanel({ districtId, fetchImpl = fetch }: RosterImportPanelProps) {
  const [vendor, setVendor] = useState<"clever" | "classlink">("clever");
  const [rawJson, setRawJson] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RosterImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleImport(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setResult(null);
    if (!rawJson.trim()) {
      setError("Paste a normalized roster JSON export.");
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      setError("That is not valid JSON.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetchImpl(`/api/rosters/import`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ districtId, vendor, ...(parsed as object) }),
      });
      if (!res.ok) {
        setError(`Import failed (${res.status}).`);
        return;
      }
      const summary = (await res.json()) as RosterImportSummary;
      setResult(summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="roster-import-panel rounded border p-4">
      <h3 className="text-lg font-semibold">Import roster</h3>
      <p className="text-xs text-gray-600">
        Paste a normalized Clever or ClassLink JSON export. Parent-owned profile fields on existing
        learners are preserved.
      </p>
      <form onSubmit={handleImport} className="mt-2 space-y-2">
        <label className="block text-sm">
          Vendor
          <select
            className="ml-2 rounded border"
            value={vendor}
            onChange={(e) => setVendor(e.target.value as "clever" | "classlink")}
          >
            <option value="clever">Clever</option>
            <option value="classlink">ClassLink</option>
          </select>
        </label>
        <textarea
          rows={6}
          value={rawJson}
          onChange={(e) => setRawJson(e.target.value)}
          className="w-full rounded border p-2 text-xs"
          placeholder='{"schools":[...],"teachers":[...],"students":[...],"classes":[...],"enrollments":[...]}'
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-blue-600 px-3 py-1.5 text-white disabled:opacity-50"
        >
          {busy ? "Importing…" : "Import"}
        </button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>
      {result ? (
        <div className="mt-3 rounded bg-gray-50 p-3 text-sm">
          <p className="font-medium">Import complete.</p>
          <ul className="mt-1 list-disc pl-5 text-xs">
            <li>Schools: {result.schoolsCreated}</li>
            <li>Classes upserted: {result.classesUpserted}</li>
            <li>Enrollments upserted: {result.enrollmentsUpserted}</li>
            <li>Teachers assigned: {result.teachersAssigned}</li>
            <li>Students added: {result.studentsAdded}</li>
            <li>
              Parent-owned profile fields preserved:{" "}
              {result.preservedParentOwnedFields ? "yes" : "no"}
            </li>
          </ul>
          {result.warnings.length > 0 ? (
            <details className="mt-2 text-xs">
              <summary>Warnings ({result.warnings.length})</summary>
              <ul className="mt-1 list-disc pl-5">
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export default RosterImportPanel;
