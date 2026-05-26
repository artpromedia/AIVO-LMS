/**
 * Sprint 14 — responsible-ai-svc metric facade.
 *
 * Delegates to the typed @aivo/observability helpers when available,
 * otherwise no-ops so unit tests run without pulling the full
 * observability registry.
 */
type Recorder = {
  block?: (detector: string, verdict: string) => void;
  evaluation?: (verdict: string) => void;
  crisis?: (tenantId: string) => void;
};

let _recorder: Recorder = {};
let _initialised = false;

async function ensureInit(): Promise<void> {
  if (_initialised) return;
  _initialised = true;
  try {
    const obs = await import("@aivo/observability");
    _recorder = {
      block:
        typeof (obs as any).recordResponsibleAiBlock === "function"
          ? (obs as any).recordResponsibleAiBlock
          : undefined,
      evaluation:
        typeof (obs as any).recordResponsibleAiEvaluation === "function"
          ? (obs as any).recordResponsibleAiEvaluation
          : undefined,
      crisis:
        typeof (obs as any).recordCrisisEscalation === "function"
          ? (obs as any).recordCrisisEscalation
          : undefined,
    };
  } catch {
    // observability not resolvable — leave recorder empty (no-op).
  }
}

export function recordResponsibleAiBlock(
  detector: string,
  verdict: string,
): void {
  void ensureInit().then(() => {
    _recorder.block?.(detector, verdict);
  });
}

export function recordResponsibleAiEvaluation(verdict: string): void {
  void ensureInit().then(() => {
    _recorder.evaluation?.(verdict);
  });
}

export function recordCrisisEscalation(tenantId: string): void {
  void ensureInit().then(() => {
    _recorder.crisis?.(tenantId);
  });
}
