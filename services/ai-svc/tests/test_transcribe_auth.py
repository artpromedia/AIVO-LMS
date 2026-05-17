"""Auth tests for /api/ai/transcribe.

Run with: pytest services/ai-svc/tests/test_transcribe_auth.py -v
"""
from __future__ import annotations

import base64
import datetime as dt

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from ai_svc import auth as auth_module
from ai_svc.main import app

VALID_AUDIO_B64 = base64.b64encode(b"\x00" * 32).decode()
ENDPOINT = "/api/ai/transcribe"


@pytest.fixture
def rsa_keys():
    priv = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pub_pem = priv.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    priv_pem = priv.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    return priv_pem, pub_pem, priv.public_key()


@pytest.fixture
def stub_public_key(rsa_keys, monkeypatch):
    _, _, pub_key_obj = rsa_keys
    monkeypatch.setattr(auth_module, "_cached_public_key", pub_key_obj)
    monkeypatch.setattr(auth_module, "_cached_at", 9_999_999_999.0)
    yield pub_key_obj


def _sign(priv_pem: bytes, claims: dict) -> str:
    now = dt.datetime.now(dt.timezone.utc)
    payload = {
        "sub": "user-123",
        "email": "kid@example.com",
        "role": "LEARNER",
        "iat": int(now.timestamp()),
        "exp": int((now + dt.timedelta(minutes=15)).timestamp()),
        "iss": "aivo:identity-svc",
        **claims,
    }
    return jwt.encode(payload, priv_pem, algorithm="RS256")


def test_transcribe_rejects_missing_token():
    client = TestClient(app)
    res = client.post(ENDPOINT, json={"audio_base64": VALID_AUDIO_B64, "mime_type": "audio/webm"})
    assert res.status_code == 401
    assert "WWW-Authenticate" in res.headers


def test_transcribe_rejects_malformed_token(stub_public_key):
    client = TestClient(app)
    res = client.post(
        ENDPOINT,
        headers={"Authorization": "Bearer not.a.real.jwt"},
        json={"audio_base64": VALID_AUDIO_B64, "mime_type": "audio/webm"},
    )
    assert res.status_code == 401


def test_transcribe_rejects_expired_token(rsa_keys, stub_public_key):
    priv_pem, _, _ = rsa_keys
    now = dt.datetime.now(dt.timezone.utc)
    expired = jwt.encode(
        {
            "sub": "user-123",
            "iat": int((now - dt.timedelta(hours=2)).timestamp()),
            "exp": int((now - dt.timedelta(hours=1)).timestamp()),
            "iss": "aivo:identity-svc",
        },
        priv_pem,
        algorithm="RS256",
    )
    client = TestClient(app)
    res = client.post(
        ENDPOINT,
        headers={"Authorization": f"Bearer {expired}"},
        json={"audio_base64": VALID_AUDIO_B64, "mime_type": "audio/webm"},
    )
    assert res.status_code == 401
    assert "expired" in res.json()["detail"].lower()


def test_transcribe_rejects_wrong_issuer(rsa_keys, stub_public_key):
    priv_pem, _, _ = rsa_keys
    token = _sign(priv_pem, {"iss": "evil:other-issuer"})
    client = TestClient(app)
    res = client.post(
        ENDPOINT,
        headers={"Authorization": f"Bearer {token}"},
        json={"audio_base64": VALID_AUDIO_B64, "mime_type": "audio/webm"},
    )
    assert res.status_code == 401


def test_transcribe_passes_auth_with_valid_token(rsa_keys, stub_public_key, monkeypatch):
    """Valid token should pass auth and reach litellm. We stub the litellm call
    so the test doesn't hit the network — we only care that the route ran past
    require_auth and into the body of `transcribe`."""
    import ai_svc.routes.transcribe as transcribe_mod

    async def fake_atranscription(**_kwargs):
        class _R:
            text = "hello world"
        return _R()

    monkeypatch.setattr(transcribe_mod.litellm, "atranscription", fake_atranscription)

    priv_pem, _, _ = rsa_keys
    token = _sign(priv_pem, {})
    client = TestClient(app)
    res = client.post(
        ENDPOINT,
        headers={"Authorization": f"Bearer {token}"},
        json={"audio_base64": VALID_AUDIO_B64, "mime_type": "audio/webm"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["transcript"] == "hello world"
