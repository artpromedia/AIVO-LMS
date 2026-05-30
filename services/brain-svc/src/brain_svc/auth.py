import logging
import os
import time

import httpx
import jwt
from cryptography.hazmat.primitives.serialization import load_pem_public_key
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

logger = logging.getLogger("brain-svc.auth")
# auto_error=False so a service-token-only request (no Bearer header) can still
# authenticate via the shared inter-service token below.
security = HTTPBearer(auto_error=False)

IDENTITY_SVC_URL = os.environ.get("IDENTITY_SVC_URL", "http://localhost:3001")

# Shared secret for trusted inter-service calls (e.g. the web-v2 BFF, which has
# already enforced session + role + learner-scope before proxying here). When
# unset, the service-token path is disabled and only user JWTs are accepted.
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
            data = resp.json()
            pem = data["publicKey"].encode()
            _cached_public_key = load_pem_public_key(pem)
            _cached_at = now
            return _cached_public_key
    except Exception as e:
        logger.warning("Failed to fetch public key: %s", e)
        if _cached_public_key:
            return _cached_public_key
    return None

def require_auth(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    x_service_token: str | None = Header(default=None, alias="x-service-token"),
) -> AuthClaims:
    # Trusted inter-service caller: a valid shared service token stands in for a
    # user. The calling service is responsible for its own authz (web-v2's BFF
    # runs requireSession + requireRole + requireLearnerScope before proxying).
    if INTERNAL_SERVICE_TOKEN and x_service_token == INTERNAL_SERVICE_TOKEN:
        return AuthClaims(sub="service", email="", role="service")

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required"
        )

    token = credentials.credentials
    public_key = _fetch_public_key()
    if not public_key:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Cannot verify tokens: identity service unavailable")

    try:
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            issuer="aivo:identity-svc",
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {e}")

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing subject")

    return AuthClaims(
        sub=sub,
        email=payload.get("email", ""),
        role=payload.get("role", ""),
    )
