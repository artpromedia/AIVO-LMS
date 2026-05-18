"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type JobResult = {
  id: string;
  status: string;
  totalRows: number;
  createdRows: number;
  skippedRows: number;
  errorRows: number;
  dryRun: boolean;
};

type ImportError = { rowNumber: number; message: string };

export function RosterImportForm({ schoolId, sampleCsv }: { schoolId: string; sampleCsv: string }) {
  const [csv, setCsv] = useState(sampleCsv);
  const [running, setRunning] = useState(false);
  const [job, setJob] = useState<JobResult | null>(null);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function submit(dryRun: boolean) {
    setRunning(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/bff/admin/rostering/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ schoolId, source: "csv", csvText: csv, dryRun }),
      });
      const body = await res.json();
      if (!body.ok) {
        setErrorMsg(body.error?.message ?? "Import failed.");
        setJob(null);
        setErrors([]);
        return;
      }
      setJob(body.data.job);
      // Fetch the error rows separately so a clean import shows none.
      const errRes = await fetch(`/api/bff/admin/rostering/import/${body.data.job.id}`);
      const errBody = await errRes.json();
      if (errBody.ok) setErrors(errBody.data.errors ?? []);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Network error.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        rows={14}
        className="w-full rounded-lg border border-aivo-border bg-aivo-surface p-3 font-mono text-xs"
        spellCheck={false}
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={running} onClick={() => submit(true)}>
          {running ? "Running…" : "Dry run"}
        </Button>
        <Button disabled={running} onClick={() => submit(false)}>
          {running ? "Running…" : "Commit import"}
        </Button>
      </div>

      {errorMsg ? (
        <p role="alert" className="rounded-md bg-aivo-danger/10 p-3 text-sm text-aivo-danger">
          {errorMsg}
        </p>
      ) : null}

      {job ? (
        <div className="rounded-lg border border-aivo-border bg-aivo-surface p-4">
          <div className="flex items-center justify-between">
            <p className="font-medium">
              Job {job.id}{" "}
              <Badge
                tone={
                  job.status === "completed"
                    ? "success"
                    : job.status === "dry_run"
                      ? "primary"
                      : "warning"
                }
              >
                {job.status}
              </Badge>
            </p>
            <p className="text-xs text-aivo-muted">
              {job.dryRun ? "Dry run — no rows persisted." : "Committed."}
            </p>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-2 text-sm">
            <div>
              <span className="text-aivo-muted">Total:</span> {job.totalRows}
            </div>
            <div>
              <span className="text-aivo-muted">Created:</span> {job.createdRows}
            </div>
            <div>
              <span className="text-aivo-muted">Skipped:</span> {job.skippedRows}
            </div>
            <div>
              <span className="text-aivo-muted">Errors:</span> {job.errorRows}
            </div>
          </div>
          {errors.length > 0 ? (
            <ul className="mt-3 space-y-1 text-xs">
              {errors.slice(0, 25).map((e) => (
                <li key={e.rowNumber} className="text-aivo-danger">
                  Row {e.rowNumber}: {e.message}
                </li>
              ))}
              {errors.length > 25 ? (
                <li className="text-aivo-muted">…and {errors.length - 25} more.</li>
              ) : null}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
