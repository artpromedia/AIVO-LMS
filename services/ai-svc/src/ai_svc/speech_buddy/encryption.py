"""Per-tenant transcript encryption for Speech Buddy.

Transcripts at rest are AES-256-GCM encrypted with a per-tenant data key
derived (HKDF-SHA256) from a master key in
``SPEECH_BUDDY_TRANSCRIPT_MASTER_KEY``. If the env var is unset (dev /
test), a deterministic in-process master is used so tests pass — log a
loud warning so it can't ship that way.

Raw audio MUST NEVER be passed to this module. Only post-STT text.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import os
import secrets
import warnings
from dataclasses import dataclass

logger = logging.getLogger("ai-svc.speech_buddy.encryption")

# Try the standard library AES-GCM first; if cryptography isn't installed
# we fall back to a clearly-marked dev-only XOR mode (still rejects
# tampered ciphertexts via HMAC).
try:  # pragma: no cover - environment-dependent
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM  # type: ignore
    _HAS_AESGCM = True
except Exception:  # pragma: no cover
    _HAS_AESGCM = False


_MASTER_ENV = "SPEECH_BUDDY_TRANSCRIPT_MASTER_KEY"
_DEV_MASTER = b"speech-buddy-dev-master-key-do-not-ship\x00\x00"  # 41 bytes


def _is_production() -> bool:
    return os.environ.get("NODE_ENV") == "production" or os.environ.get("ENV") == "production"


def _master_key() -> bytes:
    raw = os.environ.get(_MASTER_ENV)
    if raw:
        try:
            return base64.b64decode(raw, validate=True)
        except Exception:
            return raw.encode("utf-8")
    # Dev fallback — log once.
    if _is_production():
        raise RuntimeError(f"{_MASTER_ENV} is required in production")
    if not getattr(_master_key, "_warned", False):  # type: ignore[attr-defined]
        logger.warning(
            "%s not set; using dev master key. DO NOT use in production.",
            _MASTER_ENV,
        )
        _master_key._warned = True  # type: ignore[attr-defined]
    return _DEV_MASTER


def _hkdf_sha256(ikm: bytes, salt: bytes, info: bytes, length: int = 32) -> bytes:
    """RFC 5869 HKDF-SHA256 — small inline implementation to avoid extra deps."""
    if not salt:
        salt = b"\x00" * hashlib.sha256().digest_size
    prk = hmac.new(salt, ikm, hashlib.sha256).digest()
    okm = b""
    block = b""
    counter = 1
    while len(okm) < length:
        block = hmac.new(prk, block + info + bytes([counter]), hashlib.sha256).digest()
        okm += block
        counter += 1
    return okm[:length]


def derive_tenant_key(tenant_id: str) -> bytes:
    """Derive a 32-byte AES key for the given tenant id."""
    return _hkdf_sha256(
        ikm=_master_key(),
        salt=b"speech-buddy/transcript",
        info=f"tenant:{tenant_id}".encode("utf-8"),
        length=32,
    )


@dataclass(frozen=True)
class EncryptedTranscript:
    tenant_id: str
    nonce_b64: str
    ciphertext_b64: str
    """Algorithm-tagged ciphertext (``AESGCM`` or ``XOR-HMAC-DEV``)."""
    algorithm: str

    def to_dict(self) -> dict:
        return {
            "tenant_id": self.tenant_id,
            "nonce": self.nonce_b64,
            "ciphertext": self.ciphertext_b64,
            "algorithm": self.algorithm,
        }


def encrypt_transcript(tenant_id: str, plaintext: str) -> EncryptedTranscript:
    if not isinstance(plaintext, str):
        raise TypeError("encrypt_transcript expects str — never raw audio bytes")
    key = derive_tenant_key(tenant_id)
    pt = plaintext.encode("utf-8")
    if _HAS_AESGCM:
        nonce = secrets.token_bytes(12)
        ct = AESGCM(key).encrypt(nonce, pt, tenant_id.encode("utf-8"))
        return EncryptedTranscript(
            tenant_id=tenant_id,
            nonce_b64=base64.b64encode(nonce).decode("ascii"),
            ciphertext_b64=base64.b64encode(ct).decode("ascii"),
            algorithm="AES-256-GCM",
        )
    if _is_production():
        raise RuntimeError("cryptography.AESGCM is required for Speech Buddy transcripts in production")
    # Dev-only fallback: keystream from HMAC + truncated MAC for integrity.
    warnings.warn(
        "cryptography not installed; falling back to XOR-HMAC dev encryption",
        RuntimeWarning,
    )
    nonce = secrets.token_bytes(16)
    ks = _hkdf_sha256(key, nonce, b"speech-buddy/transcript-stream", length=len(pt) + 32)
    body = bytes(b ^ k for b, k in zip(pt, ks[:len(pt)]))
    tag = hmac.new(key, nonce + body + tenant_id.encode("utf-8"), hashlib.sha256).digest()[:16]
    return EncryptedTranscript(
        tenant_id=tenant_id,
        nonce_b64=base64.b64encode(nonce).decode("ascii"),
        ciphertext_b64=base64.b64encode(body + tag).decode("ascii"),
        algorithm="XOR-HMAC-DEV",
    )


def decrypt_transcript(enc: EncryptedTranscript) -> str:
    key = derive_tenant_key(enc.tenant_id)
    nonce = base64.b64decode(enc.nonce_b64)
    body = base64.b64decode(enc.ciphertext_b64)
    if enc.algorithm == "AES-256-GCM":
        if not _HAS_AESGCM:
            raise RuntimeError("Ciphertext requires cryptography.AESGCM but it is not installed")
        pt = AESGCM(key).decrypt(nonce, body, enc.tenant_id.encode("utf-8"))
        return pt.decode("utf-8")
    if enc.algorithm == "XOR-HMAC-DEV":
        if _is_production():
            raise RuntimeError("XOR-HMAC-DEV transcripts are forbidden in production")
        body_pt, tag = body[:-16], body[-16:]
        expected = hmac.new(key, nonce + body_pt + enc.tenant_id.encode("utf-8"), hashlib.sha256).digest()[:16]
        if not hmac.compare_digest(tag, expected):
            raise ValueError("transcript ciphertext failed integrity check")
        ks = _hkdf_sha256(key, nonce, b"speech-buddy/transcript-stream", length=len(body_pt) + 32)
        pt = bytes(b ^ k for b, k in zip(body_pt, ks[:len(body_pt)]))
        return pt.decode("utf-8")
    raise ValueError(f"Unknown algorithm: {enc.algorithm}")


__all__ = [
    "EncryptedTranscript",
    "decrypt_transcript",
    "derive_tenant_key",
    "encrypt_transcript",
]
