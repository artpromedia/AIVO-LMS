/**
 * Thin per-beat dispatcher used by MobileStageRuntime. Sprint 04+ extends
 * this with surface-runtime submission. For Sprint 02 it forwards beat
 * answers through the same session client.
 */

import { sessionClient } from "./sessionClient";
import type { Beat, ChoiceBeat } from "@/src/types/stage";

export const stageClient = {
  submitChoice(params: { sessionId: string; learnerId: string; beat: ChoiceBeat; answer: string }) {
    const correct = params.answer === params.beat.correctAnswer;
    return sessionClient
      .submitBeatResponse({
        sessionId: params.sessionId,
        learnerId: params.learnerId,
        beat: params.beat,
        answer: params.answer,
        correct,
      })
      .then(() => ({ correct }));
  },

  /** Acknowledge a non-interactive beat (tutor-turn etc.). */
  ackBeat(_beat: Beat) {
    return Promise.resolve();
  },
};
