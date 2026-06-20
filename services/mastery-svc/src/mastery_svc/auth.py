"""
Auth for mastery-svc — identical policy to brain-svc: a trusted inter-service
caller may present the shared ``x-service-token`` (learning-svc, brain-svc, the
web BFF), otherwise a user RS256 JWT verified against identity-svc's public key.
"""
import logging
import os
import time

import httpx
import jwt
from cryptography.hazmat.primitives.serialization import load_pem_public_key
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

logger = logging.getLogger("mastery-svc.auth")
security = HTTPBearer(auto_error=False)

IDENTITY_SVC_URL = os.environ.get("IDENTITY_SVC_URL", "http://localhost:3001")
INTERNAL_SERVICE_TOKEN = os.environ.get("INTERNAL_SERVICE_TOKEN", "")

_cached_public_key = None
_cached_at = 0
CACHE_TTL = 300


class AuthClaims:
    def __init__(self, sub: str, email: str, role: str):
        self.sub = sub
        self.email = email
        self.role = role


def _fetch_public_key():
    global _cached_public_key, _cached_at
    now = time.time()
    if _cached_public_key and (now - _cached_at) < CACHE_TTL:
        return _cached_public_key
    try:
        resp = httpx.get(f"{IDENTITY_SVC_URL}/api/auth/public-key", timeout=5)
        if resp.status_code == 200:
            pem = resp.json()["publicKey"].encode()
            _cached_public_key = load_pem_public_key(pem)
            _cached_at = now
            return _cached_public_key
    except Exception as e:  # pragma: no cover - network failure path
        logger.warning("Failed to fetch public key: %s", e)
        if _cached_public_key:
            return _cached_public_key
    return None


def require_auth(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    x_service_token: str | None = Header(default=None, alias="x-service-token"),
) -> AuthClaims:
    if INTERNAL_SERVICE_TOKEN and x_service_token == INTERNAL_SERVICE_TOKEN:
        return AuthClaims(sub="service", email="", role="service")

    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    public_key = _fetch_public_key()
    if not public_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cannot verify tokens: identity service unavailable",
        )
    try:
        payload = jwt.decode(
            credentials.credentials, public_key, algorithms=["RS256"], issuer="aivo:identity-svc"
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {e}")

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing subject")
    return AuthClaims(sub=sub, email=payload.get("email", ""), role=payload.get("role", ""))
