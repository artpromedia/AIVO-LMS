"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ConsentToggle({
  consentType,
  accepted,
  learnerId,
}: {
  consentType: string;
  accepted: boolean;
  learnerId: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onAccept() {
    setError(null);
    start(async () => {
      const url = learnerId ? `/api/bff/learners/${learnerId}/consent` : "/api/bff/consent";
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ consentType }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error?.userMessage ?? "Could not save.");
        return;
      }
      router.refresh();
    });
  }
  async function onRevoke() {
    setError(null);
    start(async () => {
      const res = await fetch(`/api/bff/consent/${consentType}/revoke`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ learnerId }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error?.userMessage ?? "Could not revoke.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1 min-w-[8rem]">
      {accepted ? (
        <Button variant="outline" size="sm" disabled={pending} onClick={onRevoke}>
          {pending ? "…" : "Revoke"}
        </Button>
      ) : (
        <Button size="sm" disabled={pending} onClick={onAccept}>
          {pending ? "…" : "Accept"}
        </Button>
      )}
      {error ? <p className="text-xs text-aivo-danger">{error}</p> : null}
    </div>
  );
}
