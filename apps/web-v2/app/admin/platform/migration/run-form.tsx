"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";

const KIND_HINT: Record<string, string> = {
  users: `[{"sourceId":"v1-u-1","payload":{"email":"old@example.com","displayName":"Old User","tenantId":"t_demo"}}]`,
  learners: `[{"sourceId":"v1-l-1","payload":{"tenantId":"t_demo","firstName":"Sky"}}]`,
  iep_documents: `[{"sourceId":"v1-iep-1","payload":{}}]`,
  lesson_runs: `[{"sourceId":"v1-lr-1","payload":{}}]`,
};

export function RunForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [source, setSource] = useState("v1-postgres");
  const [kind, setKind] = useState<keyof typeof KIND_HINT>("users");
  const [dryRun, setDryRun] = useState(true);
  const [records, setRecords] = useState(KIND_HINT.users);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    jobId: string;
    total: number;
    success: number;
    failed: number;
    skipped: number;
    dryRun: boolean;
  } | null>(null);

  function submit() {
    setError(null);
    setResult(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(records);
    } catch {
      setError("Records must be valid JSON.");
      return;
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      setError("Records must be a non-empty array.");
      return;
    }
    start(async () => {
      const res = await fetch("/api/bff/admin/migration", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source, kind, dryRun, sourceRecords: parsed }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Could not run migration.");
        return;
      }
      const job = json.data.job;
      setResult({
        jobId: job.id,
        total: job.totalRecords,
        success: job.successRecords,
        failed: job.failedRecords,
        skipped: job.skippedRecords,
        dryRun: job.dryRun,
      });
      router.refresh();
    });
  }

  return (
    <Card className="mb-6 p-[var(--aivo-density-card-pad)]">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
            Source
          </label>
          <Input value={source} onChange={(e) => setSource(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
            Kind
          </label>
          <select
            value={kind}
            onChange={(e) => {
              const k = e.target.value as keyof typeof KIND_HINT;
              setKind(k);
              setRecords(KIND_HINT[k]);
            }}
            className="mt-1 h-9 w-full rounded-md border border-aivo-border bg-aivo-surface px-2 text-sm"
          >
            <option value="users">users</option>
            <option value="learners">learners</option>
            <option value="iep_documents">iep_documents</option>
            <option value="lesson_runs">lesson_runs</option>
          </select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
            Dry run (preview only)
          </label>
        </div>
      </div>
      <div className="mt-3">
        <label className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
          Source records (JSON)
        </label>
        <Textarea
          rows={6}
          value={records}
          onChange={(e) => setRecords(e.target.value)}
          className="font-mono text-xs"
        />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button disabled={pending} onClick={submit}>
          {pending ? "Running..." : dryRun ? "Preview migration" : "Run migration"}
        </Button>
        {error ? <span className="text-sm text-aivo-danger">{error}</span> : null}
        {result ? (
          <span className="text-sm text-aivo-ink-soft">
            {result.dryRun ? "Dry run · " : "Done · "}
            {result.success}/{result.total} migrated, {result.failed} failed, {result.skipped}{" "}
            skipped
          </span>
        ) : null}
      </div>
    </Card>
  );
}
