"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import type { ReportCatalogEntry, ReportResult } from "@/lib/admin/school-ops";

interface ReportRunnerProps {
  report: ReportCatalogEntry;
  schoolId: string;
}

export function ReportRunner({ report, schoolId }: ReportRunnerProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [params, setParams] = React.useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {};
    for (const p of report.params) {
      if (p.type === "date") defaults[p.name] = today;
      if (p.type === "select" && p.options?.[0]) defaults[p.name] = p.options[0];
    }
    return defaults;
  });
  const [result, setResult] = React.useState<ReportResult | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleRun = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams(params).toString();
      const res = await fetch(`/api/bff/admin/school/reports/${report.id}?${qs}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ schoolId, params }),
      });
      const body = (await res.json()) as {
        ok: boolean;
        data?: { result: ReportResult };
        error?: { message: string };
      };
      if (!body.ok) {
        setError(body.error?.message ?? "Report failed.");
        return;
      }
      setResult(body.data!.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCsv = async () => {
    if (!result) return;
    const qs = new URLSearchParams({ ...params, format: "csv" }).toString();
    const res = await fetch(`/api/bff/admin/school/reports/${report.id}?${qs}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ schoolId, params }),
    });
    const csv = await res.text();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.id}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-5">
      {/* Parameter form */}
      {report.params.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {report.params.map((p) => (
                <div key={p.name} className="space-y-1.5">
                  <Label htmlFor={`param-${p.name}`}>{p.label}</Label>
                  {p.type === "date" && (
                    <Input
                      id={`param-${p.name}`}
                      type="date"
                      value={params[p.name] ?? ""}
                      onChange={(e) => setParams((prev) => ({ ...prev, [p.name]: e.target.value }))}
                    />
                  )}
                  {p.type === "string" && (
                    <Input
                      id={`param-${p.name}`}
                      value={params[p.name] ?? ""}
                      onChange={(e) => setParams((prev) => ({ ...prev, [p.name]: e.target.value }))}
                    />
                  )}
                  {p.type === "select" && (
                    <Select
                      value={params[p.name] ?? ""}
                      onValueChange={(v) => setParams((prev) => ({ ...prev, [p.name]: v }))}
                    >
                      <SelectTrigger id={`param-${p.name}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(p.options ?? []).map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={handleRun} disabled={isLoading} type="button">
          {isLoading ? "Running…" : "Run report"}
        </Button>
        {result && (
          <>
            <Button variant="outline" onClick={handleExportCsv} type="button">
              Export CSV
            </Button>
            <Button
              variant="outline"
              onClick={handleExportPdf}
              type="button"
              title="Opens the browser print dialog — save as PDF from there"
            >
              Export PDF (print)
            </Button>
          </>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-aivo-danger">
          {error}
        </p>
      )}

      {result && (
        <div className="overflow-x-auto print:overflow-visible">
          <p className="text-xs text-iw-ink-muted mb-2">
            Generated {new Date(result.generatedAt).toLocaleString()} · {result.rows.length} rows
          </p>
          <table className="w-full text-sm border-collapse">
            <thead className="bg-iw-card text-left">
              <tr>
                {result.columns.map((col) => (
                  <th key={col} className="border border-iw-border p-2 font-semibold">
                    {col.replace(/_/g, " ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-iw-bg" : "bg-iw-card"}>
                  {result.columns.map((col) => (
                    <td key={col} className="border border-iw-border p-2 tabular-nums">
                      {row[col] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
