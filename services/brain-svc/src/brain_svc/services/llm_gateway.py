import logging
import time
from typing import Optional

import litellm

logger = logging.getLogger("brain-svc.llm_gateway")

litellm.set_verbose = False

MODEL_PRIORITY = [
    "anthropic/claude-opus-4-7",
    "anthropic/claude-sonnet-4-6",
    "anthropic/claude-haiku-4-5",
    "gemini/gemini-3.0-pro",
    "openai/gpt-5.5",
]


def build_model_chain(preferred_model: Optional[str]) -> list[str]:
    """Order models to try, putting ``preferred_model`` first WITHOUT
    duplicating it when it is already in ``MODEL_PRIORITY`` (the old
    ``[preferred] + MODEL_PRIORITY`` double-tried the preferred model on
    failure, wasting a retry)."""
    if not preferred_model:
        return list(MODEL_PRIORITY)
    return [preferred_model] + [m for m in MODEL_PRIORITY if m != preferred_model]


async def generate_completion(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.7,
    max_tokens: int = 2000,
    preferred_model: Optional[str] = None,
) -> dict:
    models_to_try = build_model_chain(preferred_model)

    last_error = None
    for model in models_to_try:
        if model is None:
            continue
        started = time.monotonic()
        try:
            response = await litellm.acompletion(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=temperature,
                max_tokens=max_tokens,
            )

            content = response.choices[0].message.content
            usage = response.usage
            prompt_tokens = usage.prompt_tokens if usage else 0
            completion_tokens = usage.completion_tokens if usage else 0
            latency_ms = int((time.monotonic() - started) * 1000)

            # Per-call metric line (parseable by the LLM cost log pipeline).
            logger.info(
                "llm_call service=brain-svc model=%s status=ok latency_ms=%d "
                "prompt_tokens=%d completion_tokens=%d",
                model, latency_ms, prompt_tokens, completion_tokens,
            )

            return {
                "content": content,
                "model": model,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens,
                "latency_ms": latency_ms,
            }
        except Exception as e:
            latency_ms = int((time.monotonic() - started) * 1000)
            logger.warning(
                "llm_call service=brain-svc model=%s status=error latency_ms=%d error=%s",
                model, latency_ms, e,
            )
            last_error = e
            continue

    raise Exception(f"All models failed. Last error: {last_error}")
