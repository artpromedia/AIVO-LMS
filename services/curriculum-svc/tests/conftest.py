"""Shared test fixtures for curriculum-svc.

In addition to wiring ``src`` onto ``sys.path``, this provides an
in-test RS256 keypair plus a token-signing fixture so the auth tests (and
the migrated bearer test in ``test_lookup.py``) can exercise real
identity-svc-shaped JWTs without depending on a running identity-svc.
"""
import sys
import time
from pathlib import Path

import jwt as pyjwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))


@pytest.fixture(scope="session")
def rsa_keys() -> tuple[str, str]:
    """A throwaway RS256 keypair as ``(private_pem, public_pem)`` — the
    same PKCS8/SPKI PEM shapes ``@aivo/security`` produces."""
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()
    public_pem = (
        key.public_key()
        .public_bytes(
            serialization.Encoding.PEM,
            serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        .decode()
    )
    return private_pem, public_pem


@pytest.fixture
def jwt_public_key_env(rsa_keys, monkeypatch) -> str:
    """Set ``JWT_PUBLIC_KEY`` to the test public key for the duration of a
    test. Returns the public PEM."""
    _, public_pem = rsa_keys
    monkeypatch.setenv("JWT_PUBLIC_KEY", public_pem)
    return public_pem


@pytest.fixture
def sign_token(rsa_keys):
    """Return a helper that mints identity-svc-shaped access tokens.

    The default token is valid (RS256, issuer ``aivo:identity-svc``, a
    15-minute expiry). Keyword overrides let individual tests forge the
    expired / wrong-issuer / wrong-algorithm / wrong-key variants.
    """
    private_pem, public_pem = rsa_keys

    def _sign(
        claims: dict | None = None,
        *,
        expires_in: int = 900,
        issuer: str = "aivo:identity-svc",
        algorithm: str = "RS256",
        key: str | None = None,
    ) -> str:
        now = int(time.time())
        payload = {
            "sub": "user-123",
            "role": "parent",
            "tenantId": "tenant-abc",
            "iss": issuer,
            "iat": now,
            "exp": now + expires_in,
        }
        if claims:
            payload.update(claims)
        if algorithm == "none":
            return pyjwt.encode(payload, key="", algorithm="none")
        signing_key = key if key is not None else private_pem
        return pyjwt.encode(payload, signing_key, algorithm=algorithm)

    _sign.public_pem = public_pem  # type: ignore[attr-defined]
    return _sign
