"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { Dsar, DsarAction } from "@/lib/compliance/governance-store";

async function postAction(
  id: string,
  action: DsarAction,
  payload: Record<string, unknown> = {},
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/bff/admin/compliance/dsar/${id}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  const body = await res.json();
  if (!res.ok) return { ok: false, error: body?.error?.message ?? "Action failed." };
  return { ok: true };
}

export function DsarActions({ dsar }: { dsar: Dsar }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function act(action: DsarAction, payload?: Record<string, unknown>) {
    setError(null);
    start(async () => {
      const result = await postAction(dsar.id, action, payload);
      if (!result.ok) {
        setError(result.error ?? "Action failed.");
        return;
      }
      router.refresh();
    });
  }

  async function downloadBundle() {
    const res = await fetch(`/api/bff/admin/compliance/dsar/${dsar.id}?download=bundle`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error?.message ?? "Download failed.");
      return;
    }
    const json = await res.json();
    const blob = new Blob([JSON.stringify(json.data.bundle, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dsar-bundle-${dsar.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const canVerify = !dsar.identityVerified;
  const canAssign = dsar.status !== "fulfilled" && dsar.status !== "rejected";
  const canApprove = dsar.identityVerified && dsar.status === "assigned";
  const canReject = dsar.status !== "fulfilled" && dsar.status !== "rejected";
  const canFulfill = dsar.status === "approved" || dsar.status === "fulfilling";
  const isClosed = dsar.status === "fulfilled" || dsar.status === "rejected";

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {canVerify && (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => act("verify-identity", { method: "manual" })}
        >
          Verify Identity
        </Button>
      )}
      {canAssign && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => act("assign")}>
          Assign to me
        </Button>
      )}
      {canApprove && (
        <Button size="sm" disabled={pending} onClick={() => act("approve")}>
          Approve
        </Button>
      )}
      {canReject && (
        <Button
          size="sm"
          variant="danger"
          disabled={pending}
          onClick={() => act("reject", { reason: "Admin decision" })}
        >
          Reject
        </Button>
      )}
      {canFulfill && (
        <Button size="sm" disabled={pending} onClick={() => act("fulfill")}>
          Fulfill
        </Button>
      )}
      {isClosed && (
        <Button size="sm" variant="outline" onClick={downloadBundle} disabled={pending}>
          Download Bundle
        </Button>
      )}
      {error && <span className="text-xs text-aivo-danger">{error}</span>}
    </div>
  );
}
