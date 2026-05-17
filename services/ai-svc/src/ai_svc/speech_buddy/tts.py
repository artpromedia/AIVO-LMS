"""TTS adapter surface + a child-friendly mock provider.

Voice presets per age band:

  6-9   → "buddy-warm"     (warm female-presenting, slightly higher pitch)
  10-12 → "buddy-friendly" (neutral, age-appropriate energy)
  13-15 → "buddy-steady"   (calm, slightly lower pitch, less playful)

A "slow-talk" mode reduces words-per-minute to ~120 (vs ~160 default) and
inserts longer mid-sentence pauses. It is opt-in per-session — the child
toggle lives in the UI task. The orchestrator passes ``slow_talk=True``
when the planner detects the child is struggling with a turn.
"""
from __future__ import annotations

import hashlib
import logging
import os
from dataclasses import dataclass
from typing import Literal, Protocol

from .types import AgeBand

logger = logging.getLogger("ai-svc.speech_buddy.tts")

VoicePreset = Literal["buddy-warm", "buddy-friendly", "buddy-steady"]

VOICE_PRESETS: dict[AgeBand, VoicePreset] = {
    "6-9":   "buddy-warm",
    "10-12": "buddy-friendly",
    "13-15": "buddy-steady",
}

DEFAULT_WPM = 160
SLOW_TALK_WPM = 120


@dataclass(frozen=True)
class TTSResult:
    audio_bytes: bytes
    """Caller MUST drop this reference after sending; never persist."""
    mime_type: str
    voice: VoicePreset
    wpm: int
    model: str


class TTSAdapter(Protocol):
    name: str

    async def synthesize(
        self,
        text: str,
        *,
        age_band: AgeBand,
        slow_talk: bool = False,
        locale: str = "en",
    ) -> TTSResult: ...


class MockTTS:
    """Deterministic TTS: returns synthetic bytes derived from the text.

    Audio bytes are a SHA-256-based stream so tests can verify
    determinism without playing audio. Non-empty for any non-empty text.
    """

    name = "mock-tts"

    async def synthesize(
        self,
        text: str,
        *,
        age_band: AgeBand,
        slow_talk: bool = False,
        locale: str = "en",
    ) -> TTSResult:
        voice = VOICE_PRESETS[age_band]
        wpm = SLOW_TALK_WPM if slow_talk else DEFAULT_WPM
        # Synthetic, deterministic, non-empty audio bytes.
        seed = f"{voice}|{wpm}|{locale}|{text}".encode("utf-8")
        # Length proportional to text length so latency tests are
        # roughly representative; capped so tests stay fast.
        target_len = max(64, min(len(text) * 16, 4096))
        h = hashlib.sha256(seed).digest()
        audio = (h * ((target_len // len(h)) + 1))[:target_len]
        return TTSResult(
            audio_bytes=audio,
            mime_type="audio/mpeg",
            voice=voice,
            wpm=wpm,
            model=self.name,
        )


class LitellmTTS:
    """OpenAI-compatible TTS via litellm — opt-in via SPEECH_BUDDY_TTS_PROVIDER=openai.

    Keeps the surface but defers all real network calls until called.
    """

    name = "tts-1"

    async def synthesize(
        self,
        text: str,
        *,
        age_band: AgeBand,
        slow_talk: bool = False,
        locale: str = "en",
    ) -> TTSResult:
        try:
            import litellm  # type: ignore
        except Exception as exc:
            raise RuntimeError("litellm not available for LitellmTTS") from exc
        voice = VOICE_PRESETS[age_band]
        # OpenAI voices: alloy / echo / fable / onyx / nova / shimmer
        openai_voice_map = {"buddy-warm": "shimmer", "buddy-friendly": "nova", "buddy-steady": "echo"}
        speed = 0.85 if slow_talk else 1.0
        resp = await litellm.aspeech(  # type: ignore[attr-defined]
            model=self.name,
            input=text,
            voice=openai_voice_map[voice],
            speed=speed,
        )
        audio = getattr(resp, "content", None) or b""
        return TTSResult(
            audio_bytes=audio,
            mime_type="audio/mpeg",
            voice=voice,
            wpm=SLOW_TALK_WPM if slow_talk else DEFAULT_WPM,
            model=self.name,
        )


def get_default_tts() -> TTSAdapter:
    provider = (os.environ.get("SPEECH_BUDDY_TTS_PROVIDER") or "mock").lower()
    if provider == "openai":
        return LitellmTTS()
    return MockTTS()


__all__ = [
    "DEFAULT_WPM",
    "LitellmTTS",
    "MockTTS",
    "SLOW_TALK_WPM",
    "TTSAdapter",
    "TTSResult",
    "VOICE_PRESETS",
    "VoicePreset",
    "get_default_tts",
]
