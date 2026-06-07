import json
import logging
from typing import Optional
import litellm
from .budget_caps import get_ledger

logger = logging.getLogger("ai-svc.llm_gateway")

litellm.set_verbose = False

MODEL_PRIORITY = [
    "anthropic/claude-opus-4-7",
    "anthropic/claude-sonnet-4-6",
    "anthropic/claude-haiku-4-5",
    "gemini/gemini-3.0-pro",
    "openai/gpt-5.5",
]

# Models that reject the `temperature` request parameter (Anthropic
# deprecated tunable temperature on some Claude 4.5+ "extended
# thinking" SKUs). For these we omit the field so the provider uses
# its default; otherwise the call 400s and we cascade to a fallback
# model that is both more expensive AND lower quality for our use.
MODELS_WITHOUT_TEMPERATURE = {
    "anthropic/claude-opus-4-7",
}

COST_PER_1K_TOKENS = {
    "anthropic/claude-opus-4-7": {"prompt": 0.015, "completion": 0.075},
    "anthropic/claude-sonnet-4-6": {"prompt": 0.003, "completion": 0.015},
    "anthropic/claude-haiku-4-5": {"prompt": 0.0008, "completion": 0.004},
    "gemini/gemini-3.0-pro": {"prompt": 0.00125, "completion": 0.005},
    "gemini/gemini-3.0-flash": {"prompt": 0.000075, "completion": 0.0003},
    "openai/gpt-5.5": {"prompt": 0.0025, "completion": 0.01},
    "openai/gpt-5.5-mini": {"prompt": 0.00015, "completion": 0.0006},
}


VISION_MODEL_PRIORITY = [
    "anthropic/claude-sonnet-4-6",
    "gemini/gemini-3.0-pro",
    "openai/gpt-5.5",
]


def _build_system_message(model: str, system_prompt: str) -> dict:
    """Build the system message, attaching Anthropic prompt-cache markers when
    the chosen model is an Anthropic Claude variant. LiteLLM passes the
    `cache_control` field through to Anthropic's API for 5-minute ephemeral
    prompt caching, which materially reduces cost on repeated system prompts.
    Other providers do not understand the field and would error on the list
    form, so we keep their payload as plain strings.
    """
    if model.startswith("anthropic/"):
        return {
            "role": "system",
            "content": [
                {
                    "type": "text",
                    "text": system_prompt,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
        }
    return {"role": "system", "content": system_prompt}


def _mark_first_system_message_cached(messages: list[dict], model: str) -> list[dict]:
    """For chat completion: convert the first system message into the cached
    block form when targeting Anthropic. Returns a *new* list — the caller's
    messages aren't mutated.
    """
    if not model.startswith("anthropic/"):
        return messages
    out: list[dict] = []
    cached = False
    for m in messages:
        if not cached and m.get("role") == "system" and isinstance(m.get("content"), str):
            out.append(_build_system_message(model, m["content"]))
            cached = True
        else:
            out.append(m)
    return out


def _extract_cache_metrics(usage) -> tuple[int, bool]:
    """Pull cache_read_input_tokens off the LiteLLM usage object when the
    provider returned it (Anthropic does, others don't). Returns
    (cache_read_tokens, cache_hit).
    """
    if usage is None:
        return 0, False
    cache_read = (
        getattr(usage, "cache_read_input_tokens", None)
        or getattr(usage, "cache_read_tokens", None)
        or 0
    )
    try:
        cache_read = int(cache_read or 0)
    except (TypeError, ValueError):
        cache_read = 0
    return cache_read, cache_read > 0


def _log_completion(
    *,
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    cost_cents: int,
    cache_hit: bool,
    cache_read_tokens: int,
) -> None:
    """Single-line structured JSON log for every completion. Downstream
    aggregation (and the per-tenant LLM cost watchdog) parses these lines.
    """
    payload = {
        "event": "llm_completion",
        "model": model,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": prompt_tokens + completion_tokens,
        "cost_cents": cost_cents,
        "cache_hit": cache_hit,
        "cache_read_tokens": cache_read_tokens,
    }
    logger.info(json.dumps(payload))


async def generate_completion(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.7,
    max_tokens: int = 2000,
    preferred_model: Optional[str] = None,
    model_chain: Optional[list] = None,
    tenant_id: Optional[str] = None,
    response_format: Optional[dict] = None,
) -> dict:
    # Per-tenant daily budget cap (§5 ai-svc cost/reliability). Pre-flight
    # check: if the tenant has already burned through their daily cap, fail
    # fast with a structured error rather than spending more money on the
    # outbound LLM call.
    if tenant_id:
        await get_ledger().check(tenant_id)

    if model_chain:
        models_to_try = model_chain
    elif preferred_model:
        models_to_try = [preferred_model] + [m for m in MODEL_PRIORITY if m != preferred_model]
    else:
        models_to_try = MODEL_PRIORITY

    try:
        from .moderation_client import is_model_disabled
    except Exception:
        def is_model_disabled(_m: str) -> bool:  # type: ignore
            return False

    last_error = None
    for model in models_to_try:
        if model is None:
            continue
        if is_model_disabled(model):
            logger.warning("Skipping model %s (disabled by safety circuit breaker)", model)
            continue
        try:
            # Sprint 2 — forward response_format when the caller asks for
            # structured output (typically {"type": "json_object"} for
            # baseline / IEP / homework parsers). LiteLLM passes it through
            # to the provider; providers that don't natively support it
            # fall back to prompt-instructed JSON, which our pydantic
            # validator in the route layer still catches.
            kwargs: dict = {
                "model": model,
                "messages": [
                    _build_system_message(model, system_prompt),
                    {"role": "user", "content": user_prompt},
                ],
                "max_tokens": max_tokens,
            }
            if model not in MODELS_WITHOUT_TEMPERATURE:
                kwargs["temperature"] = temperature
            if response_format is not None:
                kwargs["response_format"] = response_format
            response = await litellm.acompletion(**kwargs)

            content = response.choices[0].message.content
            usage = response.usage

            prompt_tokens = usage.prompt_tokens if usage else 0
            completion_tokens = usage.completion_tokens if usage else 0
            cost_cents = (
                _calculate_cost(model, prompt_tokens, completion_tokens) if usage else 0
            )
            cache_read_tokens, cache_hit = _extract_cache_metrics(usage)
            _log_completion(
                model=model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                cost_cents=cost_cents,
                cache_hit=cache_hit,
                cache_read_tokens=cache_read_tokens,
            )
            if tenant_id and cost_cents > 0:
                await get_ledger().record(tenant_id, cost_cents)

            return {
                "content": content,
                "model": model,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens,
                "cost_cents": cost_cents,
                "cache_hit": cache_hit,
                "cache_read_tokens": cache_read_tokens,
            }
        except Exception as e:
            logger.warning(f"Model {model} failed: {e}")
            last_error = e
            continue

    raise Exception(f"All models failed. Last error: {last_error}")


async def generate_chat_completion(
    messages: list[dict],
    temperature: float = 0.7,
    max_tokens: int = 2000,
    preferred_model: Optional[str] = None,
    stream: bool = False,
    tenant_id: Optional[str] = None,
):
    # Per-tenant daily budget cap (§5 ai-svc cost/reliability).
    if tenant_id:
        await get_ledger().check(tenant_id)

    # Dedupe the preferred model so it is not double-tried when it is already
    # in MODEL_PRIORITY (matches generate_completion's chain construction).
    models_to_try = (
        [preferred_model] + [m for m in MODEL_PRIORITY if m != preferred_model]
        if preferred_model
        else list(MODEL_PRIORITY)
    )

    try:
        from .moderation_client import is_model_disabled
    except Exception:
        def is_model_disabled(_m: str) -> bool:  # type: ignore
            return False

    last_error = None
    for model in models_to_try:
        if model is None:
            continue
        if is_model_disabled(model):
            logger.warning("Skipping model %s (disabled by safety circuit breaker)", model)
            continue
        try:
            shaped_messages = _mark_first_system_message_cached(messages, model)
            chat_kwargs: dict = {
                "model": model,
                "messages": shaped_messages,
                "max_tokens": max_tokens,
            }
            if model not in MODELS_WITHOUT_TEMPERATURE:
                chat_kwargs["temperature"] = temperature
            if stream:
                return litellm.acompletion(**chat_kwargs, stream=True), model
            else:
                response = await litellm.acompletion(**chat_kwargs)
                content = response.choices[0].message.content
                usage = response.usage
                prompt_tokens = usage.prompt_tokens if usage else 0
                completion_tokens = usage.completion_tokens if usage else 0
                cost_cents = (
                    _calculate_cost(model, prompt_tokens, completion_tokens) if usage else 0
                )
                cache_read_tokens, cache_hit = _extract_cache_metrics(usage)
                _log_completion(
                    model=model,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    cost_cents=cost_cents,
                    cache_hit=cache_hit,
                    cache_read_tokens=cache_read_tokens,
                )
                if tenant_id and cost_cents > 0:
                    await get_ledger().record(tenant_id, cost_cents)
                return {
                    "content": content,
                    "model": model,
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens,
                    "total_tokens": prompt_tokens + completion_tokens,
                    "cost_cents": cost_cents,
                    "cache_hit": cache_hit,
                    "cache_read_tokens": cache_read_tokens,
                }, model
        except Exception as e:
            logger.warning(f"Model {model} failed: {e}")
            last_error = e
            continue

    raise Exception(f"All models failed. Last error: {last_error}")


def _calculate_cost(model: str, prompt_tokens: int, completion_tokens: int) -> int:
    costs = COST_PER_1K_TOKENS.get(model, {"prompt": 0.001, "completion": 0.002})
    cost_dollars = (prompt_tokens / 1000 * costs["prompt"]) + (completion_tokens / 1000 * costs["completion"])
    return int(cost_dollars * 100)
