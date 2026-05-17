"use client";

import { useState } from "react";
import {
  HomeworkStepFlow,
  type HomeworkStep,
} from "../../../../../components/homework/HomeworkStepFlow";
import {
  HomeworkUploadPanel,
  type DetectedProblem,
  type HomeworkUploadResult,
} from "../../../../../components/homework/HomeworkUploadPanel";
import { HomeworkSurfacePanel } from "../../../../../components/homework/HomeworkSurfacePanel";
import {
  SelfRegulationPrompt,
  type FocusObservationState,
  type SelfRegulationRecommendation,
} from "../../../../../components/homework/SelfRegulationPrompt";
import type { LearnerSurfaceSpec, SurfaceResponse } from "@aivo/learner-surfaces";

/**
 * Sprint 06 four-step homework helper. Mounted at
 * /dashboard/learner/homework/helper so it lives alongside the existing
 * legacy homework page without replacing it. The helper is gated by
 * AIVO_FEATURE_SELF_REGULATION_HUB on the backend; with the flag off,
 * the page still renders but the homework-svc endpoints respond as
 * no-ops.
 */
export default function LearnerHomeworkHelperPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [problems, setProblems] = useState<DetectedProblem[]>([]);
  const [currentSurface, setCurrentSurface] = useState<LearnerSurfaceSpec | null>(null);
  const [focusState, setFocusState] = useState<FocusObservationState>("focused");
  const [focusReason, setFocusReason] = useState<string | undefined>();
  const [regulation, setRegulation] = useState<SelfRegulationRecommendation | undefined>();

  async function ensureSession(): Promise<string | null> {
    if (sessionId) return sessionId;
    try {
      const res = await fetch("/api/homework-sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenantId: "current",
          learnerId: "current",
          subject: "math",
          profile: {},
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { id: string };
      setSessionId(data.id);
      return data.id;
    } catch {
      return null;
    }
  }

  function handleExtracted(result: HomeworkUploadResult) {
    setProblems(result.detectedProblems);
  }

  function handleAdvance(_next: HomeworkStep) {
    // Step engine state is owned by HomeworkStepFlow; this is a telemetry hook.
  }

  function handleSurfaceResponse(_response: SurfaceResponse) {
    // The web telemetry relay handles problem-session ledger writes.
  }

  async function startSession() {
    await ensureSession();
  }

  async function checkFocus() {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/homework-sessions/${sessionId}/focus-check`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          signals: { consecutiveWrongAttempts: 3, eraserCount: 5 },
        }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        observation: { state: FocusObservationState; reason: string };
        regulation: SelfRegulationRecommendation;
      };
      setFocusState(data.observation.state);
      setFocusReason(data.observation.reason);
      setRegulation(data.regulation);
    } catch {
      // Telemetry-grade — never block the page on a focus check.
    }
  }

  return (
    <main className="learner-homework-helper mx-auto max-w-2xl space-y-4 p-4">
      <header>
        <h1 className="text-2xl font-bold">Homework helper</h1>
        <p className="text-sm text-gray-600">
          Bring your homework. We will work through it: understand, plan, solve, check.
        </p>
      </header>

      <section>
        <button
          type="button"
          onClick={startSession}
          className="rounded bg-blue-600 px-3 py-1.5 text-white"
          disabled={Boolean(sessionId)}
        >
          {sessionId ? "Session started" : "Start a homework session"}
        </button>
      </section>

      {sessionId ? (
        <HomeworkUploadPanel sessionId={sessionId} onExtracted={handleExtracted} />
      ) : null}

      {problems.length > 0 ? (
        <section>
          <h2 className="text-lg font-semibold">We found these problems</h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {problems.map((p) => (
              <li key={p.id}>{p.prompt}</li>
            ))}
          </ol>
        </section>
      ) : null}

      <HomeworkStepFlow onAdvance={handleAdvance} />
      <HomeworkSurfacePanel surface={currentSurface} onSubmit={handleSurfaceResponse} />
      <SelfRegulationPrompt
        state={focusState}
        reason={focusReason}
        recommendation={regulation}
        onDismiss={() => setFocusState("focused")}
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={checkFocus}
          className="rounded border px-3 py-1.5 text-sm"
          disabled={!sessionId}
        >
          Check focus
        </button>
        <button
          type="button"
          onClick={() =>
            setCurrentSurface({
              id: "demo-surface",
              type: "scratchpad",
              prompt: "Show your work on the scratchpad.",
              capture: { finalAnswer: true, inkStrokes: true },
              scoring: { mode: "process" },
              accessibility: {
                altText: "Blank scratchpad",
                reduceMotionSafe: true,
                keyboardAlternative: true,
              },
              scratchpad: { enabled: true },
            } as LearnerSurfaceSpec)
          }
          className="rounded border px-3 py-1.5 text-sm"
        >
          Show a scratchpad
        </button>
      </div>
    </main>
  );
}
