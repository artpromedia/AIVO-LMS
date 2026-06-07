"""STT adapter surface with deterministic test and live Whisper providers.

Real production deployments wire ``WhisperSTT`` through litellm (see
``routes/transcribe.py``). The default in tests is ``MockSTT`` so the
suite runs offline and the safety/orchestrator paths can be exercised
end-to-end on text we control.

Audio buffers are never written to disk by any adapter in this module.
The orchestrator deletes the bytes object after STT returns; see the
``test_no_raw_audio_persisted`` test.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Optional, Protocol

logger = logging.getLogger("ai-svc.speech_buddy.stt")


@dataclass(frozen=True)
class STTResult:
    transcript: str
    language: Optional[str]
    model: str
    duration_ms: int


class STTAdapter(Protocol):
    name: str

    async def transcribe(
        self,
        audio_bytes: bytes,
        *,
        mime_type: str = "audio/webm",
        locale: Optional[str] = None,
    ) -> STTResult: ...


class MockSTT:
    """Deterministic STT: treats audio bytes as UTF-8 text (test default)."""

    name = "mock-stt"

    async def transcribe(
        self,
        audio_bytes: bytes,
        *,
        mime_type: str = "audio/webm",
        locale: Optional[str] = None,
    ) -> STTResult:
        # The test suite passes UTF-8 strings as "audio" so we can drive
        # the orchestrator deterministically. Real audio bytes would also
        # work — they'd just decode to garbage that the safety filter
        # would route as "uninteresting" → no flag.
        try:
            text = audio_bytes.decode("utf-8")
        except UnicodeDecodeError:
            text = ""
        return STTResult(transcript=text.strip(), language=locale, model=self.name, duration_ms=10)


class WhisperSTT:
    """litellm/Whisper-backed STT — opt-in via SPEECH_BUDDY_STT_PROVIDER=whisper."""

    name = "whisper-1"

    async def transcribe(
        self,
        audio_bytes: bytes,
        *,
        mime_type: str = "audio/webm",
        locale: Optional[str] = None,
    ) -> STTResult:
        import time
        try:
            import litellm  # local import; not required for tests
        except Exception as exc:
            raise RuntimeError("litellm not available for WhisperSTT") from exc
        ext = "webm" if "webm" in mime_type else mime_type.split("/")[-1] or "webm"
        file_tuple = (f"speech.{ext}", audio_bytes, mime_type)
        kwargs: dict = {"model": self.name, "file": file_tuple}
        if locale:
            kwargs["language"] = locale.split("-")[0][:2].lower()
        t0 = time.perf_counter()
        resp = await litellm.atranscription(**kwargs)
        text = (getattr(resp, "text", None) or (resp.get("text") if isinstance(resp, dict) else "") or "").strip()
        return STTResult(
            transcript=text,
            language=locale,
            model=self.name,
            duration_ms=int((time.perf_counter() - t0) * 1000),
        )


def get_default_stt() -> STTAdapter:
    """Pick STT adapter based on env; production must use real transcription."""
    provider = (os.environ.get("SPEECH_BUDDY_STT_PROVIDER") or "mock").lower()
    if provider == "whisper":
        return WhisperSTT()
    if os.environ.get("NODE_ENV") == "production" or os.environ.get("ENV") == "production":
        raise RuntimeError(
            "SPEECH_BUDDY_STT_PROVIDER=whisper is required in production; mock STT is forbidden"
        )
    return MockSTT()


__all__ = ["MockSTT", "STTAdapter", "STTResult", "WhisperSTT", "get_default_stt"]
