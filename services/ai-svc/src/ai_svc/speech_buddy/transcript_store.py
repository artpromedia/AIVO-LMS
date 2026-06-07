"""Durable per-tenant encrypted transcript persistence.

Production should swap this for an object-store backend (S3 + KMS),
but the contract — *write-only, ciphertext-only, tenant-scoped path* —
is the same. The default backend writes to
``$SPEECH_BUDDY_TRANSCRIPT_DIR`` (default ``./.data/speech-buddy``)
under ``<tenant_id>/<session_id>.json``.

The store NEVER receives plaintext. Callers must pass the
``EncryptedTranscript`` returned by ``encryption.encrypt_transcript`` —
i.e. AES-256-GCM ciphertext (or HKDF-XOR + HMAC fallback) bound to the
tenant id via the AAD / key derivation.
"""
from __future__ import annotations

import json
import logging
import os
import threading
from pathlib import Path
from typing import Optional, Protocol

from .encryption import EncryptedTranscript

logger = logging.getLogger("ai-svc.speech_buddy.transcript_store")

_DEFAULT_DIR = Path(os.environ.get("SPEECH_BUDDY_TRANSCRIPT_DIR", ".data/speech-buddy"))


class TranscriptStore(Protocol):
    def put(self, *, session_id: str, transcript: EncryptedTranscript) -> str: ...
    def get(self, *, tenant_id: str, session_id: str) -> Optional[EncryptedTranscript]: ...


class FileTranscriptStore:
    """Atomic file-based store. One file per session, per tenant directory."""

    def __init__(self, root: Optional[Path] = None) -> None:
        self.root = Path(root or _DEFAULT_DIR)
        self._lock = threading.Lock()

    def _path(self, tenant_id: str, session_id: str) -> Path:
        # Tenant id used as directory; sanitised to a-z0-9_-.
        safe_tenant = "".join(c if c.isalnum() or c in "-_" else "_" for c in tenant_id)[:128]
        safe_session = "".join(c if c.isalnum() or c in "-_" else "_" for c in session_id)[:128]
        return self.root / safe_tenant / f"{safe_session}.json"

    def put(self, *, session_id: str, transcript: EncryptedTranscript) -> str:
        path = self._path(transcript.tenant_id, session_id)
        with self._lock:
            path.parent.mkdir(parents=True, exist_ok=True)
            tmp = path.with_suffix(".json.tmp")
            tmp.write_text(json.dumps(transcript.to_dict(), separators=(",", ":")))
            tmp.replace(path)
        logger.info(
            "speech_buddy.transcript_persisted",
            extra={"tenant_id": transcript.tenant_id, "session_id": session_id, "bytes": path.stat().st_size},
        )
        return str(path)

    def get(self, *, tenant_id: str, session_id: str) -> Optional[EncryptedTranscript]:
        path = self._path(tenant_id, session_id)
        if not path.exists():
            return None
        data = json.loads(path.read_text())
        # Tenant binding: the path tenant must match the ciphertext tenant.
        if data.get("tenant_id") != tenant_id:
            logger.warning("speech_buddy.transcript_tenant_mismatch", extra={"path": str(path)})
            return None
        return EncryptedTranscript(
            tenant_id=data["tenant_id"],
            nonce_b64=data["nonce"],
            ciphertext_b64=data["ciphertext"],
            algorithm=data.get("algorithm", "AES-256-GCM"),
        )


class InMemoryTranscriptStore:
    """For tests."""

    def __init__(self) -> None:
        self._items: dict[tuple[str, str], EncryptedTranscript] = {}

    def put(self, *, session_id: str, transcript: EncryptedTranscript) -> str:
        self._items[(transcript.tenant_id, session_id)] = transcript
        return f"memory://{transcript.tenant_id}/{session_id}"

    def get(self, *, tenant_id: str, session_id: str) -> Optional[EncryptedTranscript]:
        return self._items.get((tenant_id, session_id))


_default_store: Optional[TranscriptStore] = None


def get_default_store() -> TranscriptStore:
    global _default_store
    if _default_store is None:
        if (
            os.environ.get("NODE_ENV") == "production"
            or os.environ.get("ENV") == "production"
        ) and not os.environ.get("SPEECH_BUDDY_TRANSCRIPT_DIR"):
            raise RuntimeError(
                "SPEECH_BUDDY_TRANSCRIPT_DIR is required in production and must point to durable storage"
            )
        _default_store = FileTranscriptStore()
    return _default_store


def set_default_store(store: TranscriptStore) -> None:
    global _default_store
    _default_store = store


__all__ = [
    "TranscriptStore",
    "FileTranscriptStore",
    "InMemoryTranscriptStore",
    "get_default_store",
    "set_default_store",
]
