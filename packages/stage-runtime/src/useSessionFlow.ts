/**
 * useSessionFlow — React hook that adapts SessionMachine for declarative
 * use from web (or any React renderer). Exposes the current beat, full
 * snapshot, and stable callbacks for advancing/recording answers.
 *
 * This hook stores the SessionMachine instance in a ref so re-renders
 * never recreate the machine and lose state. The snapshot in `useState`
 * is what triggers re-renders when the underlying machine mutates.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import type { Beat } from "@aivo/stage-ui";
import { SessionMachine, type SessionSnapshot, type TutorSession } from "./SessionMachine.js";

export interface UseSessionFlowResult {
  snapshot: SessionSnapshot;
  currentBeat: Beat | null;
  isComplete: boolean;
  progress: number;
  nextBeat: () => Beat | null;
  recordAnswer: (beatId: string, answer: string) => void;
}

export function useSessionFlow(session: TutorSession): UseSessionFlowResult {
  const machineRef = useRef<SessionMachine | null>(null);
  if (machineRef.current === null) {
    machineRef.current = new SessionMachine(session);
  }
  const machine = machineRef.current;

  const [snapshot, setSnapshot] = useState<SessionSnapshot>(() => machine.getState());

  const nextBeat = useCallback(() => {
    const beat = machine.nextBeat();
    setSnapshot(machine.getState());
    return beat;
  }, [machine]);

  const recordAnswer = useCallback(
    (beatId: string, answer: string) => {
      machine.recordAnswer(beatId, answer);
      setSnapshot(machine.getState());
    },
    [machine],
  );

  const currentBeat = useMemo(() => machine.currentBeat(), [machine, snapshot]);

  return {
    snapshot,
    currentBeat,
    isComplete: snapshot.isComplete,
    progress: machine.progress(),
    nextBeat,
    recordAnswer,
  };
}
