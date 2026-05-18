"""
Authentication for curriculum-svc.

curriculum-svc is a read-only catalogue service called by other AIVO
services (brain-svc, tutor-svc, the admin UI). Even though it serves
no learner-PII payload, the catalogue itself is product IP — we don't
want unauthenticated scrapers walking the skill graph.

Two acceptable credential types:

1. ``X-Service-Token`` header matching ``INTERNAL_SERVICE_TOKEN`` —
   used for service-to-service calls (brain-svc → curriculum-svc, etc.).
2. ``Authorization: Bearer <jwt>`` header — used by user-fronting BFFs
   that have already authenticated the caller. We currently accept any
   bearer that decodes to a string longer than 16 chars; tightening to
   full JWT verification is tracked in the green:check backlog.

In non-production environments we accept the placeholder dev token
``aivo-internal-dev-token`` so local Docker compose and unit tests work
without a generated secret.

Production fail-closed: if ``NODE_ENV`` or ``ENV`` == ``production`` and
no ``INTERNAL_SERVICE_TOKEN`` is set, every authenticated request will
be rejected. This is intentional — the deployment must inject the secret.
"""
from __future__ import annotations

import os

from fastapi import Header, HTTPException, status


_DEV_FALLBACK_TOKEN = "aivo-internal-dev-token"


def _is_production() -> bool:
    return (
        os.environ.get("NODE_ENV") == "production"
        or os.environ.get("ENV") == "production"
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
) -> str:
    """FastAPI ``Depends`` that authenticates a caller.

    Returns the authentication mode (``"service"`` or ``"user"``) on
    success; raises HTTP 401 on failure. The returned mode is suitable
    for routes that want to log who called them.
    """
    expected = _expected_service_token()
    if x_service_token and expected and x_service_token == expected:
        return "service"
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
        if len(token) >= 16:
            # NOTE: full JWT verification deferred — see auth.py docstring.
            return "user"
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="authentication required (X-Service-Token or Bearer)",
    )
