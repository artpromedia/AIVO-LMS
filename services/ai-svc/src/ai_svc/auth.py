"""JWT-bearer authentication for ai-svc routes.

Mirrors the contract used by `@aivo/security` (RS256, issuer
`aivo:identity-svc`) and the existing pattern in
`services/brain-svc/src/brain_svc/auth.py`. The public key is fetched from
identity-svc on first use and cached for five minutes.
"""
from __future__ import annotations

import logging
import os
import time
from typing import Optional

import httpx
import jwt
from cryptography.hazmat.primitives.serialization import load_pem_public_key
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

logger = logging.getLogger("ai-svc.auth")

IDENTITY_SVC_URL = os.environ.get("IDENTITY_SVC_URL", "http://localhost:3001")
JWT_ISSUER = "aivo:identity-svc"
PUBLIC_KEY_TTL_S = 300

# auto_error=False so we can return our own 401 body shape and message
# instead of FastAPI's default "Not authenticated".
_security = HTTPBearer(auto_error=False)

_cached_public_key = None
_cached_at: float = 0.0


class AuthClaims:
    __slots__ = ("sub", "email", "role", "tenant_id", "name")

    def __init__(
        self,
        sub: str,
        email: str = "",
        role: str = "",
        tenant_id: str = "",
        name: str = "",
    ) -> None:
        self.sub = sub
        self.email = email
        self.role = role
        self.tenant_id = tenant_id
        self.name = name


def _fetch_public_key():
    global _cached_public_key, _cached_at
    now = time.time()
    if _cached_public_key and (now - _cached_at) < PUBLIC_KEY_TTL_S:
        return _cached_public_key
    try:
        resp = httpx.get(f"{IDENTITY_SVC_URL}/api/auth/public-key", timeout=5)
        if resp.status_code == 200:
            pem = resp.json()["publicKey"].encode()
            _cached_public_key = load_pem_public_key(pem)
            _cached_at = now
            return _cached_public_key
    except Exception as exc:
        logger.warning("Failed to fetch JWT public key: %s", exc)
    # Stale cache is better than a hard 503 mid-rollout of identity-svc.
    return _cached_public_key


def require_auth(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_security),
) -> AuthClaims:
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    public_key = _fetch_public_key()
    if not public_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cannot verify tokens: identity service unavailable",
        )

    try:
        payload = jwt.decode(
            credentials.credentials,
            public_key,
            algorithms=["RS256"],
            issuer=JWT_ISSUER,
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
            headers={"WWW-Authenticate": 'Bearer error="invalid_token"'},
        )
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
            headers={"WWW-Authenticate": 'Bearer error="invalid_token"'},
        )

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing subject claim",
        )

    return AuthClaims(
        sub=str(sub),
        email=str(payload.get("email", "")),
        role=str(payload.get("role", "")),
        tenant_id=str(payload.get("tenantId", "")),
        name=str(payload.get("name", "")),
    )
