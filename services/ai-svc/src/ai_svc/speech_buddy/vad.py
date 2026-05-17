"""Simple energy-based voice-activity detection + barge-in helper.

The on-device fallback plan (see ``docs/products/speech-buddy/agent-core.md``)
recommends WebRTC VAD on the client when bandwidth permits; this server-
side helper exists so the orchestrator can declare end-of-utterance
deterministically when the client does not provide explicit boundaries.

Barge-in: while the buddy's TTS audio is streaming back to the client,
the client also sends a stream of energy samples. The orchestrator calls
``BargeInDetector.observe`` for each sample; when speech is detected
above ``threshold`` for ``min_voiced_ms`` it fires once. The orchestrator
then cancels the in-flight TTS and starts a new STT capture.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class VadFrame:
    rms: float
    """Root-mean-square energy of the frame in [0, 1]."""
    duration_ms: int


class EndOfUtteranceDetector:
    """Returns True the first time the trailing window is silent enough."""

    def __init__(
        self,
        *,
        silence_threshold: float = 0.02,
        silence_required_ms: int = 600,
        min_voiced_ms: int = 200,
    ) -> None:
        self.silence_threshold = silence_threshold
        self.silence_required_ms = silence_required_ms
        self.min_voiced_ms = min_voiced_ms
        self._silence_run_ms = 0
        self._voiced_ms = 0
        self._fired = False

    def observe(self, frame: VadFrame) -> bool:
        if self._fired:
            return False
        if frame.rms >= self.silence_threshold:
            self._voiced_ms += frame.duration_ms
            self._silence_run_ms = 0
        else:
            self._silence_run_ms += frame.duration_ms
        if (
            self._voiced_ms >= self.min_voiced_ms
            and self._silence_run_ms >= self.silence_required_ms
        ):
            self._fired = True
            return True
        return False

    def reset(self) -> None:
        self._silence_run_ms = 0
        self._voiced_ms = 0
        self._fired = False


class BargeInDetector:
    """Detects when the child interrupts the buddy mid-TTS."""

    def __init__(
        self,
        *,
        threshold: float = 0.05,
        min_voiced_ms: int = 150,
    ) -> None:
        self.threshold = threshold
        self.min_voiced_ms = min_voiced_ms
        self._voiced_ms = 0
        self._fired = False

    def observe(self, frame: VadFrame) -> bool:
        if self._fired:
            return False
        if frame.rms >= self.threshold:
            self._voiced_ms += frame.duration_ms
        else:
            # decay slightly so a brief background tap doesn't accumulate
            self._voiced_ms = max(0, self._voiced_ms - frame.duration_ms // 2)
        if self._voiced_ms >= self.min_voiced_ms:
            self._fired = True
            return True
        return False

    def reset(self) -> None:
        self._voiced_ms = 0
        self._fired = False


__all__ = ["BargeInDetector", "EndOfUtteranceDetector", "VadFrame"]
