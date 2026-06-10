"use client";

import * as React from "react";
import {
  validateCsv,
  detectColumnMapping,
  toErrorReportCsv,
  templateCsv,
  type ValidationResult,
  type ColumnMapping,
  REQUIRED_FIELDS,
  ALL_FIELDS,
} from "@aivo/learner-import";
import { Stepper, type StepperStep } from "@/components/ui/stepper";
import { Progress } from "@/components/ui/progress";
import {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
} from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

// ── Types ────────────────────────────────────────────────────────────────────

type LearnerField = (typeof ALL_FIELDS)[number];

interface WizardProps {
  schoolId: string;
}

interface JobPoll {
  id: string;
  status: string;
  progress: number;
  dryRunAdds: number;
  dryRunUpdates: number;
  createdRows: number;
  updatedRows: number;
  skippedRows: number;
  errorRows: number;
}

// ── Step labels ───────────────────────────────────────────────────────────────

const STEPS: StepperStep[] = [
  { label: "Upload", description: "Download template & upload your CSV" },
  { label: "Mapping", description: "Map columns to fields" },
  { label: "Validate", description: "Review errors & warnings" },
  { label: "Dry run", description: "Preview adds & updates" },
  { label: "Import", description: "Commit the import" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function downloadBlob(content: string, filename: string, mimeType = "text/csv"): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parseHeaderFromCsv(text: string): string[] {
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  return firstLine.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
}

// ── The wizard ────────────────────────────────────────────────────────────────

export function CsvImportWizard({ schoolId }: WizardProps) {
  const [step, setStep] = React.useState(0);
  const [csvText, setCsvText] = React.useState("");
  const [mapping, setMapping] = React.useState<ColumnMapping>({});
  const [validation, setValidation] = React.useState<ValidationResult | null>(null);
  const [jobId, setJobId] = React.useState<string | null>(null);
  const [pollJob, setPollJob] = React.useState<JobPoll | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<{ title: string; description?: string } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  // Each step heading gets a ref so we can move focus when advancing
  const headingRefs = [
    React.useRef<HTMLHeadingElement>(null),
    React.useRef<HTMLHeadingElement>(null),
    React.useRef<HTMLHeadingElement>(null),
    React.useRef<HTMLHeadingElement>(null),
    React.useRef<HTMLHeadingElement>(null),
  ];
  // Live-region for a11y announcements
  const [liveMessage, setLiveMessage] = React.useState("");

  const announce = (msg: string) => setLiveMessage(msg);

  const advanceTo = (next: number) => {
    setStep(next);
    announce(STEPS[next]?.label ?? "");
    // Focus the step heading on next tick so the DOM is updated
    setTimeout(() => {
      headingRefs[next]?.current?.focus();
    }, 50);
  };

  // ── Step 0: Upload ────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);
      announce("File loaded. Ready to proceed to column mapping.");
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    downloadBlob(templateCsv(), "learner-import-template.csv");
  };

  const handleStepUploadNext = () => {
    if (!csvText.trim()) {
      setError("Please upload or paste a CSV file before proceeding.");
      return;
    }
    setError(null);
    const header = parseHeaderFromCsv(csvText);
    const detected = detectColumnMapping(header);
    setMapping(detected);
    advanceTo(1);
  };

  // ── Step 1: Mapping ───────────────────────────────────────────────────────

  const handleMappingChange = (field: LearnerField, colIdx: number) => {
    setMapping((prev) => {
      const next = { ...prev };
      if (colIdx === -1) {
        delete next[field];
      } else {
        next[field] = colIdx;
      }
      return next;
    });
  };

  const handleMappingNext = () => {
    setError(null);
    const missing = REQUIRED_FIELDS.filter((f) => mapping[f] === undefined);
    if (missing.length > 0) {
      setError(`Please map all required fields: ${missing.join(", ")}`);
      return;
    }
    // Run client-side validation with the confirmed mapping
    const result = validateCsv(csvText, mapping);
    setValidation(result);
    advanceTo(2);
  };

  // ── Step 2: Validation ────────────────────────────────────────────────────

  const handleDownloadErrorReport = () => {
    if (!validation) return;
    const csv = toErrorReportCsv(csvText, validation);
    downloadBlob(csv, "learner-import-errors.csv");
  };

  const handleValidationNext = () => {
    if (!validation) return;
    if (validation.summary.errorRows > 0) {
      setError(
        `${validation.summary.errorRows} rows have errors. Fix or remove them before proceeding.`,
      );
      return;
    }
    setError(null);
    advanceTo(3);
  };

  // ── Step 3: Dry run ───────────────────────────────────────────────────────

  const [dryRunResult, setDryRunResult] = React.useState<{
    adds: number;
    updates: number;
  } | null>(null);

  const handleDryRun = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bff/admin/school/import/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ schoolId, csvText, mapping, dryRun: true }),
      });
      const body = (await res.json()) as {
        ok: boolean;
        data?: { job: JobPoll };
        error?: { message: string };
      };
      if (!body.ok) {
        setError(body.error?.message ?? "Dry run failed.");
        return;
      }
      const job = body.data!.job;
      setDryRunResult({ adds: job.dryRunAdds, updates: job.dryRunUpdates });
      announce(`Dry run complete. ${job.dryRunAdds} additions, ${job.dryRunUpdates} updates.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    if (step === 3 && !dryRunResult && !isLoading) {
      void handleDryRun();
    }
  }, [step]);

  const handleDryRunNext = () => {
    setError(null);
    advanceTo(4);
  };

  // ── Step 4: Commit ────────────────────────────────────────────────────────

  const handleCommit = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bff/admin/school/import/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ schoolId, csvText, mapping, dryRun: false }),
      });
      const body = (await res.json()) as {
        ok: boolean;
        data?: { job: JobPoll };
        error?: { message: string };
      };
      if (!body.ok) {
        setError(body.error?.message ?? "Import failed.");
        return;
      }
      setJobId(body.data!.job.id);
      setPollJob(body.data!.job);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setIsLoading(false);
    }
  };

  // Poll job progress
  React.useEffect(() => {
    if (!jobId) return;
    if (pollJob?.status === "completed" || pollJob?.status === "failed") return;

    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/bff/admin/school/import/${jobId}`);
        const body = (await res.json()) as {
          ok: boolean;
          data?: { job: JobPoll };
        };
        if (body.ok && body.data) {
          setPollJob(body.data.job);
          if (body.data.job.status === "completed") {
            announce("Import completed successfully.");
            setToast({
              title: "Import complete",
              description: `${body.data.job.createdRows} added, ${body.data.job.updatedRows} updated.`,
            });
          }
        }
      } catch {
        // silent
      }
    }, 800);

    return () => clearInterval(timer);
  }, [jobId, pollJob?.status]);

  const csvHeaders = csvText ? parseHeaderFromCsv(csvText) : [];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <ToastProvider>
      {/* A11Y live region */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {liveMessage}
      </div>

      <div className="space-y-6">
        <Stepper steps={STEPS} current={step} />

        {/* ── Step 0: Upload ── */}
        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>
                <h2
                  ref={headingRefs[0]}
                  tabIndex={-1}
                  className="font-iw-display text-xl font-semibold focus:outline-none"
                >
                  Step 1 — Upload CSV
                </h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-iw-ink-muted">
                Download the template, fill it in, then upload or paste the CSV below.
              </p>
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate} type="button">
                Download template CSV
              </Button>

              <div className="space-y-2">
                <label htmlFor="csv-file-upload" className="block text-sm font-medium text-iw-ink">
                  Upload CSV file
                </label>
                <input
                  id="csv-file-upload"
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-iw-ink-muted file:mr-3 file:cursor-pointer file:rounded-full file:border file:border-iw-border file:bg-iw-card file:px-3 file:py-1 file:text-sm file:font-medium hover:file:bg-iw-raised"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="csv-paste" className="block text-sm font-medium text-iw-ink">
                  Or paste CSV here
                </label>
                <textarea
                  id="csv-paste"
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  rows={10}
                  className="w-full rounded-iw-control border border-iw-border bg-iw-raised p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-iw-ring"
                  placeholder="external_id,first_name,last_name,grade,dob&#10;S1001,Ada,Lovelace,5,2014-09-01"
                  spellCheck={false}
                />
              </div>

              {error && (
                <p role="alert" className="text-sm text-aivo-danger">
                  {error}
                </p>
              )}

              <Button onClick={handleStepUploadNext} type="button">
                Next: Map columns
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Step 1: Mapping ── */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>
                <h2
                  ref={headingRefs[1]}
                  tabIndex={-1}
                  className="font-iw-display text-xl font-semibold focus:outline-none"
                >
                  Step 2 — Column Mapping
                </h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-iw-ink-muted">
                Map your CSV columns to the required and optional learner fields.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-iw-card text-left">
                    <tr>
                      <th className="p-2 font-medium">Field</th>
                      <th className="p-2 font-medium">Required?</th>
                      <th className="p-2 font-medium">CSV Column</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ALL_FIELDS.map((field) => {
                      const isRequired = (REQUIRED_FIELDS as readonly string[]).includes(field);
                      return (
                        <tr key={field} className="border-t border-iw-border">
                          <td className="p-2 font-mono text-xs">{field}</td>
                          <td className="p-2">
                            {isRequired ? (
                              <Badge tone="danger">Required</Badge>
                            ) : (
                              <Badge tone="neutral">Optional</Badge>
                            )}
                          </td>
                          <td className="p-2">
                            <label htmlFor={`map-${field}`} className="sr-only">
                              Map {field} to column
                            </label>
                            <select
                              id={`map-${field}`}
                              value={mapping[field] !== undefined ? String(mapping[field]) : "-1"}
                              onChange={(e) => handleMappingChange(field, Number(e.target.value))}
                              className="rounded-iw-control border border-iw-border bg-iw-raised px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-iw-ring"
                            >
                              <option value="-1">— not mapped —</option>
                              {csvHeaders.map((h, idx) => (
                                <option key={idx} value={String(idx)}>
                                  {h} (col {idx + 1})
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {error && (
                <p role="alert" className="text-sm text-aivo-danger">
                  {error}
                </p>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => advanceTo(0)} type="button">
                  Back
                </Button>
                <Button onClick={handleMappingNext} type="button">
                  Next: Validate
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 2: Validation ── */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>
                <h2
                  ref={headingRefs[2]}
                  tabIndex={-1}
                  className="font-iw-display text-xl font-semibold focus:outline-none"
                >
                  Step 3 — Validation Report
                </h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {validation && (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-iw-card border border-iw-border bg-iw-card p-3 text-center">
                      <p className="text-2xl font-bold">{validation.summary.totalRows}</p>
                      <p className="text-xs text-iw-ink-muted">Total rows</p>
                    </div>
                    <div className="rounded-iw-card border border-iw-border bg-iw-card p-3 text-center">
                      <p className="text-2xl font-bold text-aivo-success">
                        {validation.summary.validRows}
                      </p>
                      <p className="text-xs text-iw-ink-muted">Valid</p>
                    </div>
                    <div className="rounded-iw-card border border-iw-border bg-iw-card p-3 text-center">
                      <p className="text-2xl font-bold text-aivo-danger">
                        {validation.summary.errorRows}
                      </p>
                      <p className="text-xs text-iw-ink-muted">Errors</p>
                    </div>
                    <div className="rounded-iw-card border border-iw-border bg-iw-card p-3 text-center">
                      <p className="text-2xl font-bold text-aivo-warning">
                        {validation.summary.warningRows}
                      </p>
                      <p className="text-xs text-iw-ink-muted">Warnings</p>
                    </div>
                  </div>

                  {validation.missingColumns.length > 0 && (
                    <p
                      role="alert"
                      className="rounded-lg bg-aivo-danger/10 p-3 text-sm text-aivo-danger"
                    >
                      Missing required columns: {validation.missingColumns.join(", ")}
                    </p>
                  )}

                  {validation.issues.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-iw-card text-left">
                          <tr>
                            <th className="p-2">Row</th>
                            <th className="p-2">Level</th>
                            <th className="p-2">Field</th>
                            <th className="p-2">Message</th>
                          </tr>
                        </thead>
                        <tbody>
                          {validation.issues.slice(0, 50).map((issue, idx) => (
                            <tr key={idx} className="border-t border-iw-border">
                              <td className="p-2 tabular-nums">{issue.rowNumber}</td>
                              <td className="p-2">
                                <Badge tone={issue.level === "error" ? "danger" : "warning"}>
                                  {issue.level}
                                </Badge>
                              </td>
                              <td className="p-2 font-mono text-xs">{issue.field}</td>
                              <td className="p-2 text-iw-ink-muted">{issue.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {validation.issues.length > 50 && (
                        <p className="mt-2 text-xs text-iw-ink-muted">
                          …and {validation.issues.length - 50} more. Download the error report.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-aivo-success">
                      No issues found. All rows are valid.
                    </p>
                  )}

                  {validation.issues.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadErrorReport}
                      type="button"
                    >
                      Download error report CSV
                    </Button>
                  )}
                </>
              )}

              {error && (
                <p role="alert" className="text-sm text-aivo-danger">
                  {error}
                </p>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => advanceTo(1)} type="button">
                  Back
                </Button>
                <Button onClick={handleValidationNext} type="button">
                  Next: Dry run
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 3: Dry run ── */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>
                <h2
                  ref={headingRefs[3]}
                  tabIndex={-1}
                  className="font-iw-display text-xl font-semibold focus:outline-none"
                >
                  Step 4 — Dry Run Preview
                </h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading && <p className="text-sm text-iw-ink-muted">Running dry run…</p>}
              {dryRunResult && !isLoading && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
                  <div className="rounded-iw-card border border-iw-border bg-iw-card p-4 text-center">
                    <p className="text-3xl font-bold text-aivo-success">{dryRunResult.adds}</p>
                    <p className="mt-1 text-sm text-iw-ink-muted">New learners to add</p>
                  </div>
                  <div className="rounded-iw-card border border-iw-border bg-iw-card p-4 text-center">
                    <p className="text-3xl font-bold text-iw-primary">{dryRunResult.updates}</p>
                    <p className="mt-1 text-sm text-iw-ink-muted">Existing learners to update</p>
                  </div>
                </div>
              )}

              {error && (
                <p role="alert" className="text-sm text-aivo-danger">
                  {error}
                </p>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => advanceTo(2)} type="button">
                  Back
                </Button>
                <Button onClick={handleDryRunNext} disabled={!dryRunResult} type="button">
                  Looks good — confirm import
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 4: Commit ── */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>
                <h2
                  ref={headingRefs[4]}
                  tabIndex={-1}
                  className="font-iw-display text-xl font-semibold focus:outline-none"
                >
                  Step 5 — Commit Import
                </h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!jobId && !isLoading && (
                <>
                  <p className="text-sm text-iw-ink-muted">
                    This will write the validated rows to the database. This action cannot be
                    undone.
                  </p>
                  <Button onClick={handleCommit} type="button">
                    Commit import now
                  </Button>
                </>
              )}

              {isLoading && <p className="text-sm text-iw-ink-muted">Submitting import…</p>}

              {pollJob && (
                <div className="space-y-3">
                  <div
                    role="progressbar"
                    aria-valuenow={pollJob.progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Import progress: ${pollJob.progress}%`}
                  >
                    <Progress value={pollJob.progress} className="h-3" aria-label={`${pollJob.progress}% imported`} />
                    <p className="mt-1 text-xs text-iw-ink-muted text-right">
                      {pollJob.progress}% — {pollJob.status}
                    </p>
                  </div>

                  {pollJob.status === "completed" && (
                    <div className="rounded-lg border border-aivo-success/30 bg-aivo-success/10 p-4">
                      <p className="font-semibold text-aivo-success">Import complete!</p>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="text-iw-ink-muted">Added: </span>
                          <strong>{pollJob.createdRows}</strong>
                        </div>
                        <div>
                          <span className="text-iw-ink-muted">Updated: </span>
                          <strong>{pollJob.updatedRows}</strong>
                        </div>
                        <div>
                          <span className="text-iw-ink-muted">Skipped: </span>
                          <strong>{pollJob.skippedRows}</strong>
                        </div>
                      </div>
                    </div>
                  )}

                  {pollJob.status === "failed" && (
                    <p role="alert" className="text-sm text-aivo-danger">
                      Import failed. Please try again or contact support.
                    </p>
                  )}
                </div>
              )}

              {error && (
                <p role="alert" className="text-sm text-aivo-danger">
                  {error}
                </p>
              )}

              {pollJob?.status !== "completed" && (
                <Button
                  variant="outline"
                  onClick={() => advanceTo(3)}
                  type="button"
                  disabled={!!jobId}
                >
                  Back
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {toast && (
        <Toast open onOpenChange={() => setToast(null)} duration={5000}>
          <ToastTitle>{toast.title}</ToastTitle>
          {toast.description && <ToastDescription>{toast.description}</ToastDescription>}
        </Toast>
      )}
      <ToastViewport />
    </ToastProvider>
  );
}
