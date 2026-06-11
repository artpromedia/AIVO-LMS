import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes.health import router as health_router, root_router as health_root_router
from .routes.generate import router as generate_router
from .routes.homework import router as homework_router
from .routes.transcribe import router as transcribe_router
from .routes.curriculum import router as curriculum_router
from .routes.term_syllabus import router as term_syllabus_router
from .routes.speech_buddy import router as speech_buddy_router
from .routes.budget_admin import router as budget_admin_router
from .routes.baseline_images import router as baseline_images_router
from .routes.tutor_agent import router as tutor_agent_router
from ._observability import add_observability

app = FastAPI(
    title="AIVO AI Service",
    description="LLM Gateway + Content Generation + Tutor Chat + Homework Helper",
    version="1.1.0",
)

# Structured request logging + /metrics for Prometheus scrape (Supp A).
add_observability(app, "ai-svc")


def _parse_cors_origins() -> list[str]:
    """Parse the ``CORS_ORIGINS`` env var into an explicit allow-list.

    Mirrors the Node services (see services/identity-svc/src/index.ts).
    Production fails closed (no wildcard); dev defaults to localhost.
    """
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

app.include_router(health_router)
app.include_router(health_root_router)
app.include_router(generate_router)
app.include_router(tutor_agent_router)
app.include_router(homework_router)
app.include_router(transcribe_router)
app.include_router(curriculum_router)
app.include_router(term_syllabus_router)
app.include_router(speech_buddy_router)
app.include_router(budget_admin_router)
app.include_router(baseline_images_router)
