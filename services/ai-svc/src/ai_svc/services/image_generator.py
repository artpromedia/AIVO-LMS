"""Baseline picture-prompt image generation.

Wraps the LiteLLM image API so the ai-svc can turn a concept (typically an
emoji like ``🐱`` or a noun phrase like ``a cat on a white background``)
into an actual cartoon picture for K-2 learners. Results are persisted on
disk under a content-addressed cache so each unique concept is generated
at most once across the fleet.

Three risks this module deliberately defends against
----------------------------------------------------
1. **Cost.** Every successful generation is priced through
   :data:`IMAGE_COST_CENTS_DEFAULT` and routed through the existing
   per-tenant :class:`BudgetLedger`. A tenant that has burned through
   their daily LLM cap cannot sneak more spend in through picture
   prompts. Cache hits are free.

2. **COPPA / safety.** Concepts are scrubbed of PII (phone numbers,
   emails, SSNs, card numbers) using the same masks as
   :mod:`moderation_client`. Any prompt that looks like it's describing
   a person (``boy``, ``girl``, ``face``, ``selfie``, …) is rejected
   outright — early-learner picture prompts should be objects, animals,
   shapes, and weather, never people. Every served picture (cache hit
   or fresh generation) is logged via :func:`log_moderation_event` so
   the safety team has a complete audit trail when the kill switch
   is flipped.

3. **Operational dependencies.** When ``BASELINE_IMAGE_GEN_ENABLED`` is
   on but no ``OPENAI_API_KEY`` is set, the module loud-logs at import
   time so the missing-secret failure mode is obvious in pod logs
   instead of a flood of 502s. The default cache dir is also warned
   about so the PVC-mount requirement is hard to forget.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import logging
import os
import re
import unicodedata
from collections import defaultdict
from pathlib import Path
from typing import Optional

import httpx

from .budget_caps import BudgetExceeded, get_ledger

logger = logging.getLogger("ai_svc.image_generator")

DEFAULT_MODEL = os.environ.get("BASELINE_IMAGE_MODEL", "dall-e-3")
DEFAULT_SIZE = os.environ.get("BASELINE_IMAGE_SIZE", "1024x1024")
DEFAULT_QUALITY = os.environ.get("BASELINE_IMAGE_QUALITY", "standard")
DEFAULT_STYLE = "playful-calm-cartoon"
DEFAULT_TIMEOUT_S = float(os.environ.get("BASELINE_IMAGE_TIMEOUT_S", "12"))

# Default cache dir is ``/var/cache/...`` so it survives a read-only
# container root, but ops MUST mount a PVC there in production —
# otherwise every pod restart re-pays the generation cost for the
# entire concept corpus. See :func:`_warn_if_misconfigured` below.
CACHE_DIR = Path(
    os.environ.get("BASELINE_IMAGE_CACHE_DIR", "/var/cache/aivo-baseline-images")
)

# OpenAI list pricing as of 2025-05 (USD per image, encoded in cents).
# Picture prompts for K-2 baselines need only 1024x1024 standard;
# HD doubles the spend with no visible benefit at the 128-160px display
# size in the proctor UI. Override via
# ``BASELINE_IMAGE_COST_CENTS_<MODEL>`` env vars when pricing moves.
IMAGE_COST_CENTS_DEFAULT: dict[str, int] = {
    "dall-e-3": 4,       # $0.040 / image, 1024x1024 standard
    "dall-e-3-hd": 8,    # $0.080 / image, 1024x1024 HD
    "dall-e-2": 2,       # $0.020 / image, 1024x1024
    "gpt-image-1": 4,    # $0.040 / image, 1024x1024 medium
}


def _cost_cents_for(model: str) -> int:
    override = os.environ.get(
        f"BASELINE_IMAGE_COST_CENTS_{model.replace('-', '_').upper()}"
    )
    if override:
        try:
            return max(0, int(override))
        except ValueError:
            pass
    return IMAGE_COST_CENTS_DEFAULT.get(model, 4)


class ImageGenerationDisabled(RuntimeError):
    """Raised when the kill switch is off — caller should fall back."""


class ImageGenerationBlocked(RuntimeError):
    """Raised when a concept fails the safety pre-check (e.g. people).

    Distinct from :class:`ImageGenerationFailed` so the route layer can
    return a non-retryable response rather than a transient 502.
    """


class ImageGenerationFailed(RuntimeError):
    """Generation attempted but produced no usable image."""


def is_enabled() -> bool:
    """True when ``BASELINE_IMAGE_GEN_ENABLED`` is truthy."""
    raw = os.environ.get("BASELINE_IMAGE_GEN_ENABLED", "").strip().lower()
    return raw in {"1", "true", "yes", "on"}


# Per-concept-key asyncio.Lock so two concurrent requests for the same
# picture serialize on the cache write instead of racing to the
# expensive upstream call.
_locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)


# --- PII + safety scrubbers ----------------------------------------------
# Same mask set as ``moderation_client._mask_pii``. Duplicated (rather
# than imported) so this module stays usable in unit tests that don't
# want to pull the httpx/admin-svc surface area transitively.
_PII_MASKS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\b\d{3}-\d{2}-\d{4}\b"), ""),
    (
        re.compile(
            r"\b(?:\+?1[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}\b"
        ),
        "",
    ),
    (re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"), ""),
    (re.compile(r"\b(?:\d[ -]*?){13,16}\b"), ""),
]

# Whole-token denylist. Picture prompts for early-learner baselines must
# be objects/animals/shapes/weather — never people, never faces, never
# anything that could pull a real-looking person out of the model.
_PEOPLE_DENY_TOKENS: frozenset[str] = frozenset(
    {
        "person", "people", "human", "humans", "man", "men", "woman", "women",
        "boy", "boys", "girl", "girls", "kid", "kids", "child", "children",
        "baby", "babies", "toddler", "infant", "teen", "teens", "teenager",
        "adult", "father", "mother", "dad", "mom", "parent", "parents",
        "family", "face", "faces", "selfie", "portrait", "naked", "nude",
        "celebrity", "politician", "president",
    }
)

_PEOPLE_TOKEN_RE = re.compile(
    r"\b(" + "|".join(re.escape(w) for w in _PEOPLE_DENY_TOKENS) + r")\b",
    re.IGNORECASE,
)


def _scrub_pii(text: str) -> str:
    out = text
    for pat, repl in _PII_MASKS:
        out = pat.sub(repl, out)
    return out


def _safety_precheck(concept: str) -> None:
    """Raise :class:`ImageGenerationBlocked` for unsafe concept strings.

    The check is whole-token based and applied AFTER PII scrubbing, so a
    concept like ``"a girl named jane@x.com"`` still gets blocked on the
    ``girl`` token even though the email is stripped.
    """
    if not concept or not concept.strip():
        raise ImageGenerationBlocked("empty concept")
    match = _PEOPLE_TOKEN_RE.search(concept)
    if match:
        raise ImageGenerationBlocked(
            f"concept contains restricted token: {match.group(1)!r}"
        )


def _normalize_concept(concept: str) -> str:
    """Strip noise + Unicode-normalize so cache keys collide reliably."""
    if not concept:
        return ""
    nfkc = unicodedata.normalize("NFKC", concept).strip().lower()
    return re.sub(r"\s+", " ", nfkc)


def compute_cache_key(
    concept: str,
    *,
    model: str = DEFAULT_MODEL,
    style: str = DEFAULT_STYLE,
) -> str:
    normalized = _normalize_concept(_scrub_pii(concept))
    digest = hashlib.sha256(
        f"{model}|{style}|{normalized}".encode("utf-8")
    ).hexdigest()
    return digest


def _cache_path(key: str) -> Path:
    # Shard into two-char prefix dirs so we don't pile 10k files into
    # one directory if this scales beyond a few hundred concepts.
    return CACHE_DIR / key[:2] / f"{key}.png"


def _ensure_cache_dir() -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)


def _read_cached(key: str) -> Optional[bytes]:
    path = _cache_path(key)
    if not path.is_file():
        return None
    try:
        return path.read_bytes()
    except OSError:
        return None


def _write_cached(key: str, data: bytes) -> None:
    path = _cache_path(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".png.tmp")
    tmp.write_bytes(data)
    tmp.replace(path)


def _build_prompt(concept: str, style: str) -> str:
    """Convert a raw concept into the prompt sent to the image model.

    The envelope includes hard negative constraints ("no people, no
    faces, no text") so the model can't drift into person-shaped output
    even if the safety regex above misses an edge case.
    """
    concept_clean = _normalize_concept(_scrub_pii(concept)) or "object"
    if style == DEFAULT_STYLE:
        envelope = (
            "Bright, friendly, soft-edged children's picture-book illustration "
            "of {subject}. Cartoon style, single subject centered on a clean "
            "white background. No people, no faces, no text, no letters, no "
            "signage, no logos. Kind and calm mood suitable for a 5 year old."
        )
    else:
        envelope = "{subject}"
    return envelope.format(subject=concept_clean)


def _warn_if_misconfigured() -> None:
    """Emit one-time warnings when the flag is on but ops boxes are unchecked."""
    if not is_enabled():
        return
    if not os.environ.get("OPENAI_API_KEY"):
        logger.warning(
            "baseline_image.misconfigured: BASELINE_IMAGE_GEN_ENABLED=on but "
            "OPENAI_API_KEY is not set. Generation calls will fail and "
            "callers will fall back to the Twemoji CDN."
        )
    # ``is_mount`` is best-effort; on platforms where the cache dir
    # doesn't yet exist it returns False, which is the safe direction
    # (warn rather than miss the misconfig).
    try:
        on_volume = CACHE_DIR.is_mount()
    except OSError:
        on_volume = False
    if not on_volume and str(CACHE_DIR).startswith(("/tmp", "/var/cache")):
        logger.warning(
            "baseline_image.misconfigured: BASELINE_IMAGE_CACHE_DIR=%s is on "
            "the container's ephemeral filesystem. Mount a PVC there or every "
            "pod restart will re-pay the generation cost for the entire "
            "concept corpus.",
            CACHE_DIR,
        )


# Run misconfiguration warnings once at import time. No I/O.
_warn_if_misconfigured()


async def _call_image_api(prompt: str, *, model: str) -> bytes:
    """Invoke LiteLLM image generation; return PNG bytes.

    Raises :class:`ImageGenerationFailed` on any provider error so the
    caller can fall back rather than 500'ing.
    """
    # Late import — keeps this module importable in unit tests that
    # only exercise the cache/safety layers.
    try:
        import litellm  # type: ignore
    except Exception as exc:  # pragma: no cover - import-time failure
        raise ImageGenerationFailed(f"litellm not available: {exc}") from exc

    try:
        response = await asyncio.wait_for(
            litellm.aimage_generation(
                model=model,
                prompt=prompt,
                size=DEFAULT_SIZE,
                quality=DEFAULT_QUALITY,
                n=1,
                response_format="b64_json",
            ),
            timeout=DEFAULT_TIMEOUT_S,
        )
    except asyncio.TimeoutError as exc:
        raise ImageGenerationFailed(
            f"image generation timed out after {DEFAULT_TIMEOUT_S}s"
        ) from exc
    except Exception as exc:
        raise ImageGenerationFailed(f"image provider error: {exc}") from exc

    # LiteLLM's image response mirrors OpenAI's shape:
    # ``{"data": [{"b64_json": "..."} | {"url": "..."}]}``.
    data_list = (
        response.get("data") if isinstance(response, dict) else getattr(response, "data", None)
    )
    if not data_list:
        raise ImageGenerationFailed("image provider returned empty data")
    item = data_list[0] if isinstance(data_list, list) else data_list
    item_dict = item if isinstance(item, dict) else getattr(item, "__dict__", {})
    b64 = item_dict.get("b64_json")
    if b64:
        try:
            return base64.b64decode(b64)
        except Exception as exc:  # pragma: no cover - corrupt provider reply
            raise ImageGenerationFailed(
                f"invalid base64 from provider: {exc}"
            ) from exc

    url = item_dict.get("url")
    if url:
        try:
            async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT_S) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                return resp.content
        except Exception as exc:
            raise ImageGenerationFailed(
                f"failed to download generated image: {exc}"
            ) from exc

    raise ImageGenerationFailed("image provider returned no b64_json or url")


async def _audit_log(
    *,
    concept: str,
    key: str,
    model: str,
    cost_cents: int,
    tenant_id: Optional[str],
    learner_id: Optional[str],
    cached: bool,
    blocked_reason: Optional[str] = None,
) -> None:
    """Route the generation event through the standard safety audit log.

    Late-imported so unit tests can stub the module out. Cache hits are
    logged too (with ``cost_cents=0``) so the safety team has a complete
    record of which concepts learners actually saw — not only the ones
    that triggered a billable upstream call.
    """
    try:
        from .moderation_client import log_moderation_event
    except Exception:
        return
    try:
        log_moderation_event(
            content=concept[:200],
            flag_reason=blocked_reason
            or ("cache_hit" if cached else "image_generated"),
            content_type="baseline_image_prompt",
            model_used=model,
            tenant_id=tenant_id,
            learner_id=learner_id,
            session_id=key,
            status="BLOCKED" if blocked_reason else "AUDIT",
        )
    except Exception as exc:
        # Never let an audit-log failure break image serving.
        logger.warning("baseline_image.audit_log_failed err=%s", exc)


async def get_or_generate_image_bytes(
    concept: str,
    *,
    model: str = DEFAULT_MODEL,
    style: str = DEFAULT_STYLE,
    tenant_id: Optional[str] = None,
    learner_id: Optional[str] = None,
) -> tuple[bytes, str, bool]:
    """Return ``(png_bytes, cache_key, was_cached)`` for the concept.

    Per-concept :class:`asyncio.Lock` serializes concurrent calls. The
    per-tenant budget ledger is consulted BEFORE the upstream call and
    debited AFTER a successful one — cache hits are free.

    Raises
    ------
    ImageGenerationDisabled
        Kill switch is off.
    ImageGenerationBlocked
        Safety pre-check rejected the concept.
    BudgetExceeded
        Tenant's daily cap is already exhausted (only on cache miss).
    ImageGenerationFailed
        Upstream provider returned an error or invalid response.
    """
    if not is_enabled():
        raise ImageGenerationDisabled("BASELINE_IMAGE_GEN_ENABLED is off")

    # Safety pre-check first (cheap, deterministic). Blocked concepts
    # never touch the cache so a censored term can't be served from a
    # poisoned key.
    try:
        _safety_precheck(concept)
    except ImageGenerationBlocked as exc:
        await _audit_log(
            concept=concept,
            key="",
            model=model,
            cost_cents=0,
            tenant_id=tenant_id,
            learner_id=learner_id,
            cached=False,
            blocked_reason=str(exc),
        )
        raise

    key = compute_cache_key(concept, model=model, style=style)
    _ensure_cache_dir()

    cached = _read_cached(key)
    if cached is not None:
        await _audit_log(
            concept=concept,
            key=key,
            model=model,
            cost_cents=0,
            tenant_id=tenant_id,
            learner_id=learner_id,
            cached=True,
        )
        return cached, key, True

    async with _locks[key]:
        # Re-check after acquiring the lock; another coroutine may have
        # populated the cache while we waited.
        cached = _read_cached(key)
        if cached is not None:
            await _audit_log(
                concept=concept,
                key=key,
                model=model,
                cost_cents=0,
                tenant_id=tenant_id,
                learner_id=learner_id,
                cached=True,
            )
            return cached, key, True

        # Budget pre-flight: a tenant past their daily cap can't sneak
        # more spend in through picture prompts. Raises BudgetExceeded.
        if tenant_id:
            await get_ledger().check(tenant_id)

        prompt = _build_prompt(concept, style)
        logger.info(
            "baseline_image.generate.start key=%s model=%s style=%s tenant=%s",
            key,
            model,
            style,
            tenant_id or "-",
        )
        data = await _call_image_api(prompt, model=model)
        _write_cached(key, data)

        cost = _cost_cents_for(model)
        if tenant_id and cost > 0:
            try:
                await get_ledger().record(tenant_id, cost)
            except BudgetExceeded:
                # Already debited — but we returned the image. Let the
                # NEXT call fail at pre-check. We deliberately do NOT
                # delete the cache entry: the picture is now paid for
                # and reusable forever.
                logger.warning(
                    "baseline_image.budget_crossed tenant=%s cost_cents=%d",
                    tenant_id,
                    cost,
                )

        logger.info(
            "baseline_image.generate.done key=%s bytes=%d cost_cents=%d",
            key,
            len(data),
            cost,
        )
        await _audit_log(
            concept=concept,
            key=key,
            model=model,
            cost_cents=cost,
            tenant_id=tenant_id,
            learner_id=learner_id,
            cached=False,
        )
        return data, key, False
