/**
 * Sprint 14 — responsible-ai-svc metric facade.
 *
 * Delegates to @aivo/observability when available, otherwise no-ops so
 * unit tests run without pulling the full observability registry.
 */
type LabelMap = Record<string, string>;

interface CounterShape {
  increment(value?: number, labels?: LabelMap): void;
}

let _blockCounter: CounterShape | null = null;
let _evalCounter: CounterShape | null = null;
let _crisisCounter: CounterShape | null = null;
let _initialised = false;

async function ensureInit(): Promise<void> {
  if (_initialised) return;
  _initialised = true;
  try {
    // Dynamic import: the observability package is a sibling workspace,
    // but tests that only exercise detectors should not need it.
    const obs = await import("@aivo/observability");
    if (typeof (obs as any).createCounter === "function") {
      _blockCounter = (obs as any).createCounter("responsible_ai_block_total", [
        "detector",
        "verdict",
      ]);
      _evalCounter = (obs as any).createCounter(
        "responsible_ai_evaluation_total",
        ["verdict"],
      );
      _crisisCounter = (obs as any).createCounter("crisis_escalation_total", [
        "tenant_id",
      ]);
    }
  } catch {
    // Workspace not resolvable in this context — no-op.
  }
}

export function recordResponsibleAiBlock(
  detector: string,
  verdict: string,
): void {
  void ensureInit().then(() => {
    _blockCounter?.increment(1, { detector, verdict });
  });
}

export function recordResponsibleAiEvaluation(verdict: string): void {
  void ensureInit().then(() => {
    _evalCounter?.increment(1, { verdict });
  });
}

export function recordCrisisEscalation(tenantId: string): void {
  void ensureInit().then(() => {
    _crisisCounter?.increment(1, { tenant_id: tenantId || "unknown" });
  });
}
