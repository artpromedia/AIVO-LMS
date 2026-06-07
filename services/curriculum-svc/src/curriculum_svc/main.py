"""
curriculum-svc — read-only curriculum lookup over the bundled
skill-graphs / content-pack snapshot. See README.md for scope.
"""
from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from curriculum_svc.auth import verify_auth_config_or_raise
from curriculum_svc.routes import authoring, health, jurisdictions, lookup, validate

# Fail closed at boot: in production the service refuses to start unless a
# real credential mechanism (INTERNAL_SERVICE_TOKEN or JWT_PUBLIC_KEY) is
# configured. See curriculum_svc.auth for the rationale.
verify_auth_config_or_raise()

app = FastAPI(
    title="AIVO Curriculum Service",
    version="0.1.0",
    description="Read-only curriculum lookup over the AIVO skill-graphs and content-pack catalogue.",
)


def _parse_cors_origins() -> list[str]:
    """Parse ``CORS_ORIGINS`` env var; production fails closed (no wildcard)."""
    raw = os.environ.get("CORS_ORIGINS", "").strip()
    if raw:
        return [s.strip() for s in raw.split(",") if s.strip()]
    if os.environ.get("NODE_ENV") == "production" or os.environ.get("ENV") == "production":
        return []
    return [
        "http://localhost:3000",
        "http://localhost:5000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5000",
    ]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api/curriculum", tags=["health"])
app.include_router(lookup.router, prefix="/api/curriculum", tags=["curriculum"])
app.include_router(jurisdictions.router, prefix="/api/curriculum", tags=["curriculum"])
app.include_router(validate.router, prefix="/api/curriculum", tags=["curriculum"])
app.include_router(authoring.router, prefix="/api/curriculum", tags=["authoring"])
