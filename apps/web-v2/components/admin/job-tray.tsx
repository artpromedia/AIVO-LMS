"use client";

import * as React from "react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { ImportJob } from "@/lib/admin/school-ops";

interface JobTrayProps {
  schoolId: string;
}

type JobStatus = ImportJob["status"];

function statusTone(status: JobStatus): "success" | "warning" | "danger" | "neutral" | "primary" {
  if (status === "completed") return "success";
  if (status === "failed") return "danger";
  if (status === "dry_run") return "primary";
  if (status === "running" || status === "validating") return "warning";
  return "neutral";
}

export function JobTray({ schoolId }: JobTrayProps) {
  const [jobs, setJobs] = React.useState<ImportJob[]>([]);
  const [open, setOpen] = React.useState(false);
  const [hasActive, setHasActive] = React.useState(false);

  const fetchJobs = React.useCallback(async () => {
    try {
      const res = await fetch(
        `/api/bff/admin/school/import/run?schoolId=${encodeURIComponent(schoolId)}`,
      );
      if (!res.ok) return;
      const body = (await res.json()) as {
        ok: boolean;
        data?: { jobs: ImportJob[] };
      };
      if (body.ok && body.data) {
        setJobs(body.data.jobs);
        const active = body.data.jobs.some(
          (j) => j.status === "running" || j.status === "queued" || j.status === "validating",
        );
        setHasActive(active);
      }
    } catch {
      // silent
    }
  }, [schoolId]);

  // Poll while there are active jobs
  React.useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  React.useEffect(() => {
    if (!hasActive) return;
    const timer = setInterval(() => void fetchJobs(), 1500);
    return () => clearInterval(timer);
  }, [hasActive, fetchJobs]);

  if (jobs.length === 0) return null;

  const recentJobs = jobs.slice(0, 5);
  const activeCount = jobs.filter((j) => j.status === "running" || j.status === "queued").length;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-72">
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mb-1 flex w-full items-center justify-between rounded-lg border border-iw-border bg-iw-card px-3 py-2 text-sm font-medium shadow-md focus:outline-none focus:ring-2 focus:ring-iw-ring"
        aria-expanded={open}
        aria-controls="job-tray-panel"
      >
        <span>Import jobs</span>
        <span className="flex items-center gap-2">
          {activeCount > 0 && <Badge tone="warning">{activeCount} active</Badge>}
          <span aria-hidden>{open ? "▲" : "▼"}</span>
        </span>
      </button>

      {open && (
        <div
          id="job-tray-panel"
          role="region"
          aria-label="Import job status"
          className="rounded-lg border border-iw-border bg-iw-card shadow-lg"
        >
          <ul className="divide-y divide-iw-border">
            {recentJobs.map((job) => (
              <li key={job.id} className="p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-iw-ink-muted truncate">
                    {job.id.slice(0, 16)}…
                  </span>
                  <Badge tone={statusTone(job.status)}>{job.status}</Badge>
                </div>
                {(job.status === "running" || job.status === "queued") && (
                  <div
                    role="progressbar"
                    aria-valuenow={job.progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Job progress: ${job.progress}%`}
                  >
                    <Progress value={job.progress} className="h-1.5" aria-label={`${job.progress}% complete`} />
                  </div>
                )}
                {job.status === "completed" && (
                  <p className="text-xs text-iw-ink-muted">
                    {job.createdRows} added · {job.updatedRows} updated
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
