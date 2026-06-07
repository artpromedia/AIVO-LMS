"""
RS256 JWT verification for curriculum-svc.

curriculum-svc accepts user-fronting requests that carry an access token
issued by identity-svc. Those tokens are signed by ``@aivo/security``'s
``signJWT`` helper: algorithm ``RS256``, issuer ``aivo:identity-svc``,
claims ``sub`` / ``tenantId`` / ``role`` (plus ``amr`` / ``acr`` / ``exp``).
We verify them here against the shared ``JWT_PUBLIC_KEY`` — the SPKI PEM
public half of the platform RS256 keypair that identity-svc signs with.

Security properties enforced here (the reason this module exists):

- Signatures are checked with **RS256 only**. We pass
  ``algorithms=["RS256"]`` explicitly, which rejects both the ``alg: none``
  downgrade and the HS256-confusion attack (signing a forged token with the
  public key treated as an HMAC secret).
- ``exp`` is always required and enforced — expired tokens are rejected.
- ``iss`` is always required and must equal ``JWT_ISSUER`` (default
  ``aivo:identity-svc`` — the value ``@aivo/security`` signs with).
- ``aud`` is enforced **only** when ``JWT_AUDIENCE`` is configured. Platform
  access tokens do not currently set an audience, so requiring one by
  default would reject every legitimate token; making it opt-in keeps us
  forward-compatible without breaking today's callers.

The module never falls back to an unverified decode. A missing public key
raises :class:`JWTConfigError` (a configuration fault) rather than quietly
accepting the token.
"""
from __future__ import annotations

import os
from dataclasses import dataclass

import jwt as pyjwt

DEFAULT_ISSUER = "aivo:identity-svc"


class JWTConfigError(RuntimeError):
    """Raised when JWT verification is requested but ``JWT_PUBLIC_KEY`` is
    not configured. This is an operator/deployment fault, distinct from a
    caller presenting a bad token."""


class JWTVerificationError(Exception):
    """Raised when a token is present but fails verification (bad
    signature, expired, wrong issuer/algorithm, malformed, …)."""


@dataclass(frozen=True)
class VerifiedClaims:
    """The subset of verified claims curriculum-svc routes care about,
    plus the raw payload for callers that need more."""

    sub: str
    role: str
    tenant_id: str | None
    raw: dict


def _public_key() -> str:
    key = os.environ.get("JWT_PUBLIC_KEY", "").strip()
    if not key:
        raise JWTConfigError("JWT_PUBLIC_KEY is not configured")
    # Container env files commonly store PEMs with literal "\n" escapes on a
    # single line. Accept both that form and real newlines.
    return key.replace("\\n", "\n")


def verify(token: str) -> VerifiedClaims:
    """Verify ``token`` and return its claims, or raise.

    Raises :class:`JWTConfigError` if no public key is configured, and
    :class:`JWTVerificationError` for any token that fails verification.
    """
    public_key = _public_key()
    issuer = os.environ.get("JWT_ISSUER", DEFAULT_ISSUER)
    audience = os.environ.get("JWT_AUDIENCE", "").strip() or None
    options = {
        "require": ["exp", "iss"],
        "verify_aud": audience is not None,
    }
    try:
        payload = pyjwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            issuer=issuer,
            audience=audience,
            options=options,
        )
    except (pyjwt.PyJWTError, ValueError, TypeError) as exc:
        raise JWTVerificationError(str(exc)) from exc

    sub = payload.get("sub")
    if not isinstance(sub, str) or not sub:
        raise JWTVerificationError("token missing a usable 'sub' claim")

    role = payload.get("role")
    if not isinstance(role, str) or not role:
        # A verified token without a role is a valid authenticated user; we
        # default to the least-privileged "user" rather than rejecting it.
        role = "user"

    tenant_id = payload.get("tenantId")
    if tenant_id is not None and not isinstance(tenant_id, str):
        tenant_id = str(tenant_id)

    return VerifiedClaims(sub=sub, role=role, tenant_id=tenant_id, raw=payload)
