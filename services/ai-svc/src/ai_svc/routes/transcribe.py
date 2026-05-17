"""Speech-to-text transcription endpoint.

Used as a fallback when the browser's Web Speech API is unavailable
(Safari iOS, Firefox, locked-down environments, or accessibility setups
that disable on-device recognition). Accepts a base64-encoded audio
clip and returns a transcript via Whisper through LiteLLM.
"""
from __future__ import annotations

import base64
import logging
from typing import Optional

import litellm
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..auth import AuthClaims, require_auth

logger = logging.getLogger("ai-svc.transcribe")

router = APIRouter(prefix="/api/ai", tags=["transcribe"])

MAX_AUDIO_BYTES = 5 * 1024 * 1024  # 5 MB decoded safety cap (~60s of 16kHz opus)
# Base64 expands by ~4/3, plus JSON overhead. Cap the encoded string a bit higher.
MAX_BASE64_CHARS = 7 * 1024 * 1024
WHISPER_MODEL_PRIORITY = [
    "whisper-1",
    "groq/whisper-large-v3",
]


class TranscribeRequest(BaseModel):
    audio_base64: str = Field(
        ...,
        description="Base64-encoded audio bytes",
        max_length=MAX_BASE64_CHARS,
    )
    mime_type: str = Field(
        "audio/webm",
        description="MIME type of the audio clip",
        max_length=128,
    )
    locale: Optional[str] = Field(
        None,
        description="BCP-47 locale hint, e.g. 'en-US', 'es-ES'",
        max_length=16,
    )


class TranscribeResponse(BaseModel):
    transcript: str
    language: Optional[str] = None
    model: str
    duration_ms: Optional[int] = None


def _ext_from_mime(mime_type: str) -> str:
    mt = (mime_type or "").lower()
    if "webm" in mt:
        return "webm"
    if "ogg" in mt:
        return "ogg"
    if "mp4" in mt or "m4a" in mt:
        return "m4a"
    if "wav" in mt:
        return "wav"
    if "mpeg" in mt or "mp3" in mt:
        return "mp3"
    return "webm"


def _normalize_locale(locale: Optional[str]) -> Optional[str]:
    if not locale:
        return None
    # Whisper expects ISO-639-1 (two-letter) language codes
    return locale.split("-")[0].split("_")[0].lower()[:2] or None


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(
    req: TranscribeRequest,
    user: AuthClaims = Depends(require_auth),
) -> TranscribeResponse:
    logger.info("transcribe called by sub=%s role=%s", user.sub, user.role)
    try:
        audio_bytes = base64.b64decode(req.audio_base64, validate=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid base64 audio: {exc}") from exc

    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio payload")
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio clip exceeds 5MB limit")

    ext = _ext_from_mime(req.mime_type)
    language = _normalize_locale(req.locale)
    file_tuple = (f"speech.{ext}", audio_bytes, req.mime_type or f"audio/{ext}")

    last_error: Optional[Exception] = None
    for model in WHISPER_MODEL_PRIORITY:
        try:
            kwargs: dict = {"model": model, "file": file_tuple}
            if language:
                kwargs["language"] = language
            response = await litellm.atranscription(**kwargs)
            text = (getattr(response, "text", None) or
                    (response.get("text") if isinstance(response, dict) else "") or "").strip()
            if not text:
                logger.info("Whisper model %s returned empty transcript", model)
            return TranscribeResponse(transcript=text, language=language, model=model)
        except Exception as exc:
            logger.warning("Transcription model %s failed: %s", model, exc)
            last_error = exc
            continue

    raise HTTPException(
        status_code=503,
        detail=f"Transcription unavailable: {last_error}",
    )
