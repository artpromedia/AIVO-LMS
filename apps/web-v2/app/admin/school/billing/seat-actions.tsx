"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AssignSeatRow({ licenseId, remaining }: { licenseId: string; remaining: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [subjectId, setSubjectId] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-aivo-border bg-aivo-surface-2 p-3">
      <span className="text-sm text-aivo-ink-soft">{remaining} seats remaining</span>
      <Input
        value={subjectId}
        onChange={(e) => setSubjectId(e.target.value)}
        placeholder="learner or teacher id"
        className="w-72"
      />
      <Button
        size="sm"
        disabled={pending || !subjectId.trim() || remaining <= 0}
        onClick={() => {
          setError(null);
          start(async () => {
            const res = await fetch("/api/bff/admin/seats", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ licenseId, subjectId: subjectId.trim(), subjectKind: subjectId.startsWith("u_") ? "teacher" : "learner" }),
            });
            const json = await res.json();
            if (!res.ok) {
              setError(json?.error?.message ?? "Could not assign seat.");
              return;
            }
            setSubjectId("");
            router.refresh();
          });
        }}
      >
        {pending ? "Assigning..." : "Assign seat"}
      </Button>
      {error ? <span className="text-sm text-aivo-danger">{error}</span> : null}
    </div>
  );
}

export function RevokeSeatButton({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await fetch("/api/bff/admin/seats", {
            method: "DELETE",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ assignmentId }),
          });
          router.refresh();
        })
      }
    >
      {pending ? "..." : "Revoke"}
    </Button>
  );
}
