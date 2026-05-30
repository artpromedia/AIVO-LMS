import logging
import os
import re
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from brain_svc.routes import health, brain, snapshots, recommendations, analysis, curriculum, playground, pacing
from brain_svc.models.database import engine, Base
from brain_svc._observability import add_observability


_EXPECTED_404_RE = re.compile(
    r'"GET /api/brain/[0-9a-fA-F-]+(?:/review|/pre-clone-data|/next-action)? HTTP/[\d.]+" 404'
)


class _ExpectedNotFoundFilter(logging.Filter):
    """Suppress uvicorn access-log noise for the by-design 404 the frontend
    uses to detect that a learner's brain has not been cloned yet."""

    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        return not _EXPECTED_404_RE.search(msg)


logging.getLogger("uvicorn.access").addFilter(_ExpectedNotFoundFilter())

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(
    title="AIVO Brain Service",
    version="1.0.0",
    description="Brain clone pipeline, state management, and versioned snapshots",
    lifespan=lifespan,
)

# Structured request logging + /metrics for Prometheus scrape (Supp A).
add_observability(app, "brain-svc")

def _parse_cors_origins() -> list[str]:
    """Parse the ``CORS_ORIGINS`` env var into an explicit allow-list.

    Mirrors the behaviour of the Node services (see services/identity-svc
    /src/index.ts: ``CORS_ORIGINS`` parsing). In production an explicit
    list is required; in development we default to the local web/marketing
    origins so the dev workflow keeps working without extra env wiring.
    """
    raw = os.environ.get("CORS_ORIGINS", "").strip()
    if raw:
        return [s.strip() for s in raw.split(",") if s.strip()]
    if os.environ.get("NODE_ENV") == "production" or os.environ.get("ENV") == "production":
        # Fail closed — no wildcard fallback in production.
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
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["Health"])
app.include_router(health.router, prefix="/api/brain", tags=["Health"])
app.include_router(brain.router, prefix="/api/brain", tags=["Brain"])
app.include_router(snapshots.router, prefix="/api/brain/snapshots", tags=["Snapshots"])
app.include_router(recommendations.router, prefix="/api/brain/recommendations", tags=["Recommendations"])
app.include_router(analysis.router, prefix="/api/brain/analysis", tags=["AI Analysis"])
app.include_router(curriculum.router, prefix="/api/brain/curriculum", tags=["Curriculum"])
app.include_router(pacing.router, prefix="/api/brain/pacing", tags=["Pacing"])
app.include_router(playground.router, prefix="/api/brain/playground", tags=["Playground"])
