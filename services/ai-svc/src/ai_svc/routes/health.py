from fastapi import APIRouter

router = APIRouter(prefix="/api/ai", tags=["health"])

# Root-level router exposed for k8s liveness/readiness/startup probes that
# hit /health (without the /api/ai prefix).
root_router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    return {"status": "ok", "service": "ai-svc"}


@root_router.get("/health")
async def health_root():
    return {"status": "ok", "service": "ai-svc"}
