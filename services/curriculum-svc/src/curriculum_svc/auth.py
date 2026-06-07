"""
Authentication for curriculum-svc.

curriculum-svc is a read-only catalogue service called by other AIVO
services (brain-svc, tutor-svc, the admin UI). Even though it serves no
learner-PII payload, the catalogue itself is product IP — we don't want
unauthenticated scrapers walking the skill graph.

Two real credential modes:

1. ``X-Service-Token`` header matching ``INTERNAL_SERVICE_TOKEN`` — used
   for service-to-service calls (brain-svc → curriculum-svc, etc.). The
   comparison is constant-time to avoid leaking the token via timing.
2. ``Authorization: Bearer <jwt>`` header — a real RS256 access token
   issued by identity-svc, verified against the shared ``JWT_PUBLIC_KEY``
   (see :mod:`curriculum_svc.jwt_verifier`). Signature, ``exp`` and ``iss``
   are all enforced; ``alg: none`` / HS256-confusion are rejected.

In non-production environments we accept the placeholder dev token
``aivo-internal-dev-token`` so local Docker compose and unit tests work
without a generated secret.

Production fail-closed, two layers:

- **Boot:** :func:`verify_auth_config_or_raise` (called from ``main``)
  refuses to start in production unless at least one real credential
  mechanism (``INTERNAL_SERVICE_TOKEN`` or ``JWT_PUBLIC_KEY``) is set.
- **Request:** if no service token is configured in production the
  expected value becomes an impossible-to-match sentinel, and an absent
  ``JWT_PUBLIC_KEY`` makes every Bearer fail verification. Either way the
  service rejects rather than fabricating access.
"""
from __future__ import annotations

import hmac
import os
from dataclasses import dataclass

from fastapi import Header, HTTPException, status

from curriculum_svc import jwt_verifier

_DEV_FALLBACK_TOKEN = "aivo-internal-dev-token"  # noqa: S105 (dev-only sentinel)


@dataclass(frozen=True)
class Principal:
    """The authenticated caller. ``mode`` is ``"service"`` or ``"user"``;
    routes can authorize per-learner off ``sub`` / ``role`` / ``tenant_id``."""

    mode: str
    sub: str
    role: str
    tenant_id: str | None = None


def _is_production() -> bool:
    return (
        os.environ.get("NODE_ENV") == "production"
        or os.environ.get("ENV") == "production"
    )


def _service_token_configured() -> bool:
    return bool(os.environ.get("INTERNAL_SERVICE_TOKEN", ""))


def _jwt_configured() -> bool:
    return bool(os.environ.get("JWT_PUBLIC_KEY", "").strip())


def verify_auth_config_or_raise() -> None:
    """Boot-time fail-closed guard.

    In production at least one real credential mechanism must be present.
    Without one the service could only ever 401, so we crash loudly at
    startup to force the deployment to inject a secret rather than ship a
    service that silently rejects every caller.
    """
    if _is_production() and not _service_token_configured() and not _jwt_configured():
        raise RuntimeError(
            "curriculum-svc refuses to boot in production without "
            "INTERNAL_SERVICE_TOKEN or JWT_PUBLIC_KEY configured."
        )


def _expected_service_token() -> str:
    configured = os.environ.get("INTERNAL_SERVICE_TOKEN", "")
    if configured:
        return configured
    if _is_production():
        # No token configured in production — fail closed. Return an
        # impossible-to-match sentinel so every comparison fails.
        return "\0PROD_TOKEN_NOT_CONFIGURED\0"
    return _DEV_FALLBACK_TOKEN


def require_service_or_user(
    x_service_token: str | None = Header(default=None, alias="X-Service-Token"),
    authorization: str | None = Header(default=None),
) -> Principal:
    """FastAPI ``Depends`` that authenticates a caller.

    Returns a :class:`Principal` on success; raises HTTP 401 on failure.
    """
    expected = _expected_service_token()
    if x_service_token and expected and hmac.compare_digest(x_service_token, expected):
        return Principal(
            mode="service",
            sub="internal-service",
            role="service",
            tenant_id=None,
        )

    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
        try:
            claims = jwt_verifier.verify(token)
        except (jwt_verifier.JWTConfigError, jwt_verifier.JWTVerificationError):
            # No public key configured, or the token failed verification.
            # Either way we fall through to 401 — never accept unverified.
            claims = None
        if claims is not None:
            return Principal(
                mode="user",
                sub=claims.sub,
                role=claims.role,
                tenant_id=claims.tenant_id,
            )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="authentication required (X-Service-Token or verified Bearer JWT)",
    )
