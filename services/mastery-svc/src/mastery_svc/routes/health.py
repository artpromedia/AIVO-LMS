from fastapi import APIRouter

from mastery_svc import config

router = APIRouter()


@router.get("/health")
def health() -> dict:
    return {
        "status": "healthy",
        "service": "mastery-svc",
        "model_version": config.MODEL_VERSION,
        "model_enabled": config.mastery_model_enabled(),
    }
