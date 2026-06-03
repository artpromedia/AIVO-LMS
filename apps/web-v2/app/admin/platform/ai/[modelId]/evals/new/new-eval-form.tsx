"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface NewEvalFormProps {
  modelId: string;
}

const HARNESSES = ["safety-suite", "accuracy-suite", "bias-suite", "full-suite"];

export function NewEvalForm({ modelId }: NewEvalFormProps) {
  const [harness, setHarness] = React.useState(HARNESSES[0]);
  const [status, setStatus] = React.useState<"idle" | "running" | "done" | "error">("idle");
  const [message, setMessage] = React.useState<string>("");
  const [run, setRun] = React.useState<any>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("running");
    setMessage("");
    setRun(null);
    try {
      const res = await fetch("/api/bff/admin/ai/evals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ modelId, harness }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        setStatus("error");
        setMessage(json?.error?.message ?? "Failed to start eval.");
        return;
      }
      setRun(json?.data?.run ?? json?.run ?? null);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Failed to start eval.");
    }
  }

  return (
    <Card className="p-[var(--aivo-density-card-pad)]">
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label className="text-xs uppercase tracking-wide text-aivo-ink-soft" htmlFor="harness">
            Eval harness
          </label>
          <select
            id="harness"
            value={harness}
            onChange={(e) => setHarness(e.target.value)}
            className="mt-1 block w-full max-w-sm rounded-iw-control border border-iw-border bg-iw-raised px-3 py-2 text-sm"
          >
            {HARNESSES.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit" disabled={status === "running"}>
          {status === "running" ? "Running…" : "Kick off eval"}
        </Button>

        {message ? <p className="text-sm text-aivo-danger">{message}</p> : null}

        {run ? (
          <div className="rounded-md bg-aivo-surface-2 p-4 text-sm">
            <p className="font-semibold">Run started</p>
            <dl className="mt-2 grid grid-cols-2 gap-1 text-xs">
              <dt className="text-aivo-ink-soft">ID</dt>
              <dd className="tabular-nums">{run.id}</dd>
              <dt className="text-aivo-ink-soft">Status</dt>
              <dd>{run.status}</dd>
              <dt className="text-aivo-ink-soft">Harness</dt>
              <dd>{run.harness}</dd>
            </dl>
          </div>
        ) : null}
      </form>
    </Card>
  );
}
