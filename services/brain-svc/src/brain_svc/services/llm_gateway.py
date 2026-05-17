import logging
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


async def generate_completion(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.7,
    max_tokens: int = 2000,
    preferred_model: Optional[str] = None,
) -> dict:
    models_to_try = [preferred_model] + MODEL_PRIORITY if preferred_model else MODEL_PRIORITY

    last_error = None
    for model in models_to_try:
        if model is None:
            continue
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

            return {
                "content": content,
                "model": model,
                "prompt_tokens": usage.prompt_tokens if usage else 0,
                "completion_tokens": usage.completion_tokens if usage else 0,
                "total_tokens": (usage.prompt_tokens + usage.completion_tokens) if usage else 0,
            }
        except Exception as e:
            logger.warning(f"Model {model} failed: {e}")
            last_error = e
            continue

    raise Exception(f"All models failed. Last error: {last_error}")
