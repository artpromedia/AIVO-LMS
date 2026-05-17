"use client";

import { useEffect, useState } from "react";

export interface DpaRecord {
  id: string;
  districtId: string;
  version: string;
  acceptedById: string;
  acceptedByName: string;
  acceptedByRole: string;
  acceptedAt: string;
}

export interface DistrictDpaPanelProps {
  districtId: string;
  fetchImpl?: typeof fetch;
}

export function DistrictDpaPanel({ districtId, fetchImpl = fetch }: DistrictDpaPanelProps) {
  const [latest, setLatest] = useState<DpaRecord | null>(null);
  const [version, setVersion] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchImpl(`/api/dpa/${districtId}/latest`);
        if (res.status === 404) {
          setLatest(null);
          return;
        }
        if (!res.ok) {
          setError(`Failed to load DPA (${res.status}).`);
          return;
        }
        setLatest((await res.json()) as DpaRecord);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load DPA.");
      }
    })();
  }, [districtId, fetchImpl]);

  async function acceptDpa() {
    if (!version.trim()) {
      setError("Enter the DPA version you are accepting.");
      return;
    }
    setError(null);
    try {
      const res = await fetchImpl(`/api/dpa/accept`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          districtId,
          version,
          acceptedById: "current",
          acceptedByName: "Current admin",
          acceptedByRole: "district_admin",
        }),
      });
      if (!res.ok) {
        setError(`Acceptance failed (${res.status}).`);
        return;
      }
      setLatest((await res.json()) as DpaRecord);
      setVersion("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Acceptance failed.");
    }
  }

  return (
    <section className="district-dpa-panel rounded border p-4">
      <h3 className="text-lg font-semibold">Data Processing Agreement</h3>
      {latest ? (
        <p className="mt-1 text-sm">
          Latest acceptance: <span className="font-medium">{latest.version}</span> by{" "}
          {latest.acceptedByName} ({latest.acceptedByRole}) on{" "}
          {new Date(latest.acceptedAt).toLocaleString()}.
        </p>
      ) : (
        <p className="mt-1 text-sm text-amber-700">No DPA acceptance recorded for this district.</p>
      )}
      <div className="mt-2 flex items-center gap-2">
        <input
          type="text"
          placeholder="DPA version (e.g. v2.0)"
          className="rounded border p-1 text-sm"
          value={version}
          onChange={(e) => setVersion(e.target.value)}
        />
        <button
          type="button"
          onClick={acceptDpa}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white"
        >
          Accept DPA
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}

export default DistrictDpaPanel;
