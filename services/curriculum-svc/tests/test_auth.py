"""Auth tests for curriculum-svc — real RS256 JWT verification + the
service-token path, exercised both at the unit level
(:mod:`curriculum_svc.jwt_verifier`) and through the FastAPI app.

Run with:
    PYTHONPATH=services/curriculum-svc/src pytest services/curriculum-svc/tests/test_auth.py -v
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import importlib
import json

import pytest
from fastapi.testclient import TestClient

import curriculum_svc.main as main_module
from curriculum_svc import auth, jwt_verifier
from curriculum_svc.main import app

client = TestClient(app)

# A protected endpoint to probe end-to-end. ``/health`` stays public.
_PROTECTED = "/api/curriculum/lookup"
_PROTECTED_PARAMS = {"subject": "math", "gradeBand": "K", "zipCode": "55104"}


def _get_protected(**headers: str):
    return client.get(_PROTECTED, params=_PROTECTED_PARAMS, headers=headers)


# ── Service-token mode ────────────────────────────────────────────────


def test_valid_dev_service_token_authenticates():
    r = _get_protected(**{"X-Service-Token": "aivo-internal-dev-token"})
    assert r.status_code == 200


def test_configured_service_token_authenticates(monkeypatch):
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", "s3cret-rotated-token")
    r = _get_protected(**{"X-Service-Token": "s3cret-rotated-token"})
    assert r.status_code == 200


def test_wrong_service_token_is_rejected(monkeypatch):
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", "s3cret-rotated-token")
    r = _get_protected(**{"X-Service-Token": "not-the-token"})
    assert r.status_code == 401


def test_missing_credentials_is_rejected():
    r = client.get(_PROTECTED, params=_PROTECTED_PARAMS)
    assert r.status_code == 401


# ── JWT mode (unit) ───────────────────────────────────────────────────


def test_verify_returns_principal_claims(jwt_public_key_env, sign_token):
    claims = jwt_verifier.verify(sign_token())
    assert claims.sub == "user-123"
    assert claims.role == "parent"
    assert claims.tenant_id == "tenant-abc"


def test_verify_without_public_key_raises_config_error(monkeypatch, sign_token):
    monkeypatch.delenv("JWT_PUBLIC_KEY", raising=False)
    with pytest.raises(jwt_verifier.JWTConfigError):
        jwt_verifier.verify(sign_token())


def test_verify_rejects_expired_token(jwt_public_key_env, sign_token):
    with pytest.raises(jwt_verifier.JWTVerificationError):
        jwt_verifier.verify(sign_token(expires_in=-10))


def test_verify_rejects_tampered_signature(jwt_public_key_env, sign_token):
    token = sign_token()
    header, payload, signature = token.split(".")
    # Flip a character in the signature segment.
    tampered_sig = ("A" if signature[0] != "A" else "B") + signature[1:]
    with pytest.raises(jwt_verifier.JWTVerificationError):
        jwt_verifier.verify(f"{header}.{payload}.{tampered_sig}")


def test_verify_rejects_wrong_issuer(jwt_public_key_env, sign_token):
    with pytest.raises(jwt_verifier.JWTVerificationError):
        jwt_verifier.verify(sign_token(issuer="evil:issuer"))


def test_verify_rejects_alg_none(jwt_public_key_env, sign_token):
    # An unsigned token must never be accepted.
    with pytest.raises(jwt_verifier.JWTVerificationError):
        jwt_verifier.verify(sign_token(algorithm="none"))


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def test_verify_rejects_hs256_confusion(jwt_public_key_env):
    # Classic RS/HS confusion: an attacker forges an HS256 token using the
    # *public* key as the HMAC secret. (pyjwt's own encode() refuses this,
    # so we hand-assemble the token to model the real attack.) Pinning
    # algorithms=["RS256"] must reject it at the algorithm check.
    public_pem = jwt_public_key_env
    header = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = _b64url(json.dumps({"sub": "attacker", "iss": "aivo:identity-svc"}).encode())
    signing_input = f"{header}.{payload}"
    sig = hmac.new(public_pem.encode(), signing_input.encode(), hashlib.sha256).digest()
    forged = f"{signing_input}.{_b64url(sig)}"
    with pytest.raises(jwt_verifier.JWTVerificationError):
        jwt_verifier.verify(forged)


def test_verify_aud_enforced_only_when_configured(
    jwt_public_key_env, sign_token, monkeypatch
):
    # Default: no JWT_AUDIENCE → tokens without aud are accepted.
    assert jwt_verifier.verify(sign_token()).sub == "user-123"
    # Configured: a token without the expected aud is rejected.
    monkeypatch.setenv("JWT_AUDIENCE", "curriculum-svc")
    with pytest.raises(jwt_verifier.JWTVerificationError):
        jwt_verifier.verify(sign_token())
    # …and a token carrying the right aud passes.
    ok = jwt_verifier.verify(sign_token({"aud": "curriculum-svc"}))
    assert ok.sub == "user-123"


# ── JWT mode (HTTP) ───────────────────────────────────────────────────


def test_valid_jwt_authenticates_over_http(jwt_public_key_env, sign_token):
    r = _get_protected(Authorization=f"Bearer {sign_token()}")
    assert r.status_code == 200


def test_expired_jwt_rejected_over_http(jwt_public_key_env, sign_token):
    r = _get_protected(Authorization=f"Bearer {sign_token(expires_in=-10)}")
    assert r.status_code == 401


def test_garbage_bearer_rejected_over_http(jwt_public_key_env):
    # The old "any 16+ char bearer" shortcut is gone: a non-JWT string fails.
    r = _get_protected(Authorization="Bearer a-bearer-longer-than-16-chars")
    assert r.status_code == 401


def test_bearer_without_public_key_is_rejected(monkeypatch, sign_token):
    # Even a well-formed token cannot be trusted if we have no key to
    # verify it against — fail closed.
    monkeypatch.delenv("JWT_PUBLIC_KEY", raising=False)
    r = _get_protected(Authorization=f"Bearer {sign_token()}")
    assert r.status_code == 401


# ── Production fail-closed (boot) ─────────────────────────────────────


def test_production_without_any_secret_fails_to_boot(monkeypatch):
    monkeypatch.setenv("NODE_ENV", "production")
    monkeypatch.delenv("INTERNAL_SERVICE_TOKEN", raising=False)
    monkeypatch.delenv("JWT_PUBLIC_KEY", raising=False)
    with pytest.raises(RuntimeError):
        auth.verify_auth_config_or_raise()


def test_production_with_service_token_boots(monkeypatch):
    monkeypatch.setenv("NODE_ENV", "production")
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", "prod-token")
    monkeypatch.delenv("JWT_PUBLIC_KEY", raising=False)
    auth.verify_auth_config_or_raise()  # must not raise


def test_production_with_jwt_key_boots(monkeypatch, rsa_keys):
    _, public_pem = rsa_keys
    monkeypatch.setenv("NODE_ENV", "production")
    monkeypatch.delenv("INTERNAL_SERVICE_TOKEN", raising=False)
    monkeypatch.setenv("JWT_PUBLIC_KEY", public_pem)
    auth.verify_auth_config_or_raise()  # must not raise


def test_main_module_import_runs_boot_guard(monkeypatch):
    # Importing main in production with no secret must raise at import time.
    monkeypatch.setenv("NODE_ENV", "production")
    monkeypatch.delenv("INTERNAL_SERVICE_TOKEN", raising=False)
    monkeypatch.delenv("JWT_PUBLIC_KEY", raising=False)
    with pytest.raises(RuntimeError):
        importlib.reload(main_module)
    # Restore a clean module state for any later tests importing it.
    monkeypatch.setenv("INTERNAL_SERVICE_TOKEN", "restore-token")
    importlib.reload(main_module)
