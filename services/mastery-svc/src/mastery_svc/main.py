import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from mastery_svc._observability import add_observability
from mastery_svc.models import tables  # noqa: F401 — registers ORM models on Base.metadata
from mastery_svc.models.database import Base, engine
from mastery_svc.routes import health, mastery


@asynccontextmanager
async def lifespan(app: FastAPI):
    # No-op against the platform DB (Drizzle owns the tables); does real work for
    # standalone/test runs against an empty database.
    if engine is not None:
        Base.metadata.create_all(bind=engine, checkfirst=True)
    yield


app = FastAPI(
    title="AIVO Mastery Service",
    version="1.0.0",
    description="Local knowledge-tracing model (BKT) — drives the LLM's delivery level and "
    "closes the learning loop by ingesting graded answers.",
    lifespan=lifespan,
)

add_observability(app, "mastery-svc")


def _parse_cors_origins() -> list[str]:
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
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["Health"])
app.include_router(health.router, prefix="/api/mastery", tags=["Health"])
app.include_router(mastery.router, prefix="/api/mastery", tags=["Mastery"])
