"use client";

import { useState } from "react";

export interface DeletionRequestStatus {
  id: string;
  learnerId: string;
  status:
    | "PENDING_REVIEW"
    | "BLOCKED_BY_RETENTION_HOLD"
    | "SOFT_DELETED"
    | "READY_FOR_HARD_DELETE"
    | "HARD_DELETED"
    | "CANCELLED";
  exportBeforeDelete: boolean;
  retentionHold?: { districtId: string; reason: string; expiresAt?: string };
  createdAt: string;
  updatedAt: string;
}

export interface DeletionRequestPanelProps {
  learnerId: string;
  requesterId: string;
  fetchImpl?: typeof fetch;
}

const STATUS_STYLE: Record<DeletionRequestStatus["status"], string> = {
  PENDING_REVIEW: "bg-gray-200 text-gray-800",
  BLOCKED_BY_RETENTION_HOLD: "bg-amber-200 text-amber-900",
  SOFT_DELETED: "bg-blue-200 text-blue-800",
  READY_FOR_HARD_DELETE: "bg-orange-200 text-orange-800",
  HARD_DELETED: "bg-red-200 text-red-800",
  CANCELLED: "bg-gray-300 text-gray-700",
};

export function DeletionRequestPanel({
  learnerId,
  requesterId,
  fetchImpl = fetch,
}: DeletionRequestPanelProps) {
  const [status, setStatus] = useState<DeletionRequestStatus | null>(null);
  const [exportBefore, setExportBefore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function requestDeletion() {
    setError(null);
    try {
      const res = await fetchImpl("/api/deletion-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          learnerId,
          requesterId,
          requesterRole: "parent",
          exportBeforeDelete: exportBefore,
          retentionHolds: [],
        }),
      });
      if (!res.ok) {
        setError(`Request failed (${res.status}).`);
        return;
      }
      setStatus((await res.json()) as DeletionRequestStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    }
  }

  return (
    <section className="deletion-request-panel rounded border p-4">
      <h3 className="text-lg font-semibold">Delete learner data</h3>
      <p className="text-xs text-gray-600">
        Submit a deletion request. If the district has an active retention
        hold, the request is recorded but blocked until the hold expires.
      </p>
      <label className="mt-2 block text-sm">
        <input
          type="checkbox"
          checked={exportBefore}
          onChange={(e) => setExportBefore(e.target.checked)}
          className="mr-1"
        />
        Export data before deletion
      </label>
      <button
        type="button"
        onClick={requestDeletion}
        className="mt-2 rounded bg-red-600 px-3 py-1.5 text-white"
      >
        Submit deletion request
      </button>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      {status ? (
        <div className="mt-3 rounded bg-gray-50 p-3 text-sm">
          <p>
            Status:{" "}
            <span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLE[status.status]}`}>
              {status.status}
            </span>
          </p>
          {status.retentionHold ? (
            <p className="mt-1 text-xs text-gray-700">
              Blocked by retention hold: {status.retentionHold.reason}
              {status.retentionHold.expiresAt
                ? ` until ${new Date(status.retentionHold.expiresAt).toLocaleString()}`
                : ""}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export default DeletionRequestPanel;
