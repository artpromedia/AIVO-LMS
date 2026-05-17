"""
AI Prompt Playground endpoint.

Used by the admin AI Playground UI to test tutor system prompts and model
configurations against real LLM providers via litellm. Admin-only.
"""
import logging
from typing import List, Literal, Optional

import litellm
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from brain_svc.auth import AuthClaims, require_auth

logger = logging.getLogger("brain-svc.playground")

router = APIRouter()


# Map the UI's friendly model id -> a concrete litellm model string.
# Keep this list in sync with apps/web .../ai/playground/page.tsx MODELS.
# NOTE: target strings must be valid litellm model identifiers (verified against
# litellm.model_cost). UI labels are stable; backend remaps to real model names.
MODEL_MAP: dict[str, str] = {
    # OpenAI (latest GPT-5.5 family; gpt-5.5-mini does not exist in litellm,
    # so fall back to gpt-5-mini for the "mini" variant).
    "gpt-5.5": "gpt-5.5",
    "gpt-5.5-mini": "gpt-5-mini",
    # Anthropic (latest Claude 4 series).
    "claude-opus-4-7": "claude-opus-4-7",
    "claude-sonnet-4-6": "claude-sonnet-4-6",
    "claude-haiku-4-5": "claude-haiku-4-5",
    # Google Gemini (3.x preview line; "gemini/" prefix uses AI Studio REST API
    # with GOOGLE_API_KEY rather than Vertex which would require google-auth).
    "gemini-3.0-pro": "gemini/gemini-3-pro-preview",
    "gemini-3.0-flash": "gemini/gemini-3-flash-preview",
}

ADMIN_ROLES = {"PLATFORM_ADMIN", "DISTRICT_ADMIN"}


class PlaygroundMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class PlaygroundRequest(BaseModel):
    model: str = Field(..., description="UI model id, e.g. 'claude-opus-4-7'")
    tutorKey: Optional[str] = None
    systemPrompt: str = ""
    messages: List[PlaygroundMessage]
    temperature: float = 0.7
    maxTokens: int = Field(500, ge=1, le=4000)


@router.post("")
async def playground_complete(
    body: PlaygroundRequest,
    auth: AuthClaims = Depends(require_auth),
):
    if auth.role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admin access required")

    litellm_model = MODEL_MAP.get(body.model)
    if not litellm_model:
        raise HTTPException(status_code=400, detail=f"Unsupported model: {body.model}")

    chat: list[dict] = []
    if body.systemPrompt.strip():
        chat.append({"role": "system", "content": body.systemPrompt.strip()})
    for m in body.messages:
        chat.append({"role": m.role, "content": m.content})

    if not any(m["role"] == "user" for m in chat):
        raise HTTPException(status_code=400, detail="At least one user message is required")

    # GPT-5 reasoning models consume part of max_tokens for internal reasoning,
    # so a small max_tokens can yield empty visible output. Ensure a reasonable
    # floor for those models, and use max_completion_tokens which is the
    # OpenAI-recommended parameter for the GPT-5 family.
    completion_budget = body.maxTokens
    extra_kwargs: dict = {}
    if litellm_model.startswith("gpt-5") or litellm_model.startswith("openai/gpt-5"):
        completion_budget = max(body.maxTokens, 800)
        extra_kwargs["max_completion_tokens"] = completion_budget
    else:
        extra_kwargs["max_tokens"] = completion_budget

    # Some reasoning models (Claude 4 series, GPT-5 series) deprecate
    # `temperature`. Only pass it for models known to still accept it.
    supports_temperature = not (
        litellm_model.startswith("gpt-5")
        or litellm_model.startswith("openai/gpt-5")
        or litellm_model.startswith("claude-opus-4")
        or litellm_model.startswith("claude-sonnet-4")
        or litellm_model.startswith("claude-haiku-4")
    )
    if supports_temperature:
        extra_kwargs["temperature"] = body.temperature

    try:
        response = await litellm.acompletion(
            model=litellm_model,
            messages=chat,
            **extra_kwargs,
        )
    except Exception as e:
        # Retry without temperature if the provider rejected it as deprecated.
        if "temperature" in str(e).lower() and "temperature" in extra_kwargs:
            extra_kwargs.pop("temperature", None)
            try:
                response = await litellm.acompletion(
                    model=litellm_model,
                    messages=chat,
                    **extra_kwargs,
                )
            except Exception as e2:
                logger.warning("Playground model %s failed: %s", litellm_model, e2)
                raise HTTPException(status_code=502, detail=f"Model call failed: {e2}")
        else:
            logger.warning("Playground model %s failed: %s", litellm_model, e)
            raise HTTPException(status_code=502, detail=f"Model call failed: {e}")

    content = response.choices[0].message.content if response.choices else ""
    usage = getattr(response, "usage", None)
    return {
        "response": content,
        "model": litellm_model,
        "tutorKey": body.tutorKey,
        "usage": {
            "promptTokens": getattr(usage, "prompt_tokens", 0) or 0,
            "completionTokens": getattr(usage, "completion_tokens", 0) or 0,
            "totalTokens": getattr(usage, "total_tokens", 0) or 0,
        },
    }
