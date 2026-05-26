"""HTTP route serving generated picture-prompt images.

GET /api/ai/baseline-image?concept=cat&style=playful-calm-cartoon

Returns the cached PNG (or generates it on demand). The endpoint emits a
strong ETag matching the deterministic cache key so browsers and the
proctor UI can cache aggressively.

When the feature flag is off the route 302-redirects to the equivalent
Twemoji CDN URL so callers don't need to implement their own fallback
— the same proctor-UI ``<img src>`` keeps working whether ops has
enabled paid image generation or not.
"""

from __future__ import annotations

import logging
import re
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Query, Request, Response
from fastapi.responses import RedirectResponse

from ..services.budget_caps import BudgetExceeded
from ..services.image_generator import (
    DEFAULT_MODEL,
    DEFAULT_STYLE,
    ImageGenerationBlocked,
    ImageGenerationDisabled,
    ImageGenerationFailed,
    compute_cache_key,
    get_or_generate_image_bytes,
    is_enabled,
)

logger = logging.getLogger("ai_svc.routes.baseline_images")

router = APIRouter(prefix="/api/ai", tags=["baseline-images"])

TWEMOJI_CDN_BASE = (
    "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg"
)

# Mirror of the curated keyword→emoji map in
# apps/web-v2/lib/learner/baseline-image.ts. Kept in sync so a
# server-side fallback for an English keyword (``cat``) still returns a
# usable picture even when generation is off.
KEYWORD_TO_EMOJI: dict[str, str] = {
    "cat": "🐱", "kitten": "🐱", "dog": "🐶", "puppy": "🐶",
    "bird": "🐦", "fish": "🐟", "cow": "🐮", "pig": "🐷",
    "horse": "🐴", "rabbit": "🐰", "bunny": "🐰", "mouse": "🐭",
    "bear": "🐻", "lion": "🦁", "tiger": "🐯", "elephant": "🐘",
    "monkey": "🐵", "frog": "🐸", "duck": "🦆", "butterfly": "🦋",
    "bee": "🐝", "sun": "☀️", "moon": "🌙", "star": "⭐",
    "cloud": "☁️", "rain": "🌧️", "snow": "❄️", "tree": "🌳",
    "flower": "🌸", "apple": "🍎", "banana": "🍌", "bread": "🍞",
    "cake": "🎂", "pizza": "🍕", "milk": "🥛", "water": "💧",
    "ice": "🧊", "car": "🚗", "bus": "🚌", "truck": "🚚",
    "bike": "🚲", "boat": "⛵", "plane": "✈️", "ball": "⚽",
    "book": "📖", "smile": "😊", "happy": "😊", "sad": "😢",
    "angry": "😠", "baby": "👶", "circle": "⭕", "square": "🟥",
    "triangle": "🔺", "heart": "❤️",
}


def _emoji_to_twemoji_slug(emoji: str) -> Optional[str]:
    """Convert an emoji to Twemoji's hex-codepoint filename slug."""
    parts: list[str] = []
    for ch in emoji:
        cp = ord(ch)
        # FE0F is the variation selector; Twemoji strips it from filenames.
        if cp == 0xFE0F:
            continue
        parts.append(f"{cp:x}")
    return "-".join(parts) if parts else None


def _twemoji_url_for(concept: str) -> Optional[str]:
    """Best-effort: turn an emoji or English keyword into a Twemoji URL."""
    if not concept:
        return None
    # If the concept already looks like an emoji (any non-ASCII char), try
    # converting it directly.
    if any(ord(ch) > 127 for ch in concept):
        slug = _emoji_to_twemoji_slug(concept)
        if slug:
            return f"{TWEMOJI_CDN_BASE}/{slug}.svg"
    # Otherwise, English keyword fallback.
    lower = concept.strip().lower()
    matched = KEYWORD_TO_EMOJI.get(lower)
    if not matched:
        # Try whole-word match against the curated keys.
        for keyword, emoji in KEYWORD_TO_EMOJI.items():
            if re.search(rf"\b{re.escape(keyword)}\b", lower):
                matched = emoji
                break
    if matched:
        slug = _emoji_to_twemoji_slug(matched)
        if slug:
            return f"{TWEMOJI_CDN_BASE}/{slug}.svg"
    return None


@router.get("/baseline-image")
async def get_baseline_image(
    request: Request,
    concept: str = Query(..., min_length=1, max_length=120),
    style: str = Query(DEFAULT_STYLE, max_length=40),
    model: Optional[str] = Query(None, max_length=80),
    # ``<img src>`` cannot set custom headers, so we accept tenant/learner
    # as either a header (server-to-server calls) or a query param
    # (browser-issued image requests). Header wins on conflict.
    tenant_id_q: Optional[str] = Query(None, alias="tenant_id", max_length=80),
    learner_id_q: Optional[str] = Query(None, alias="learner_id", max_length=80),
    tenant_id_h: Optional[str] = Header(None, alias="x-tenant-id"),
    learner_id_h: Optional[str] = Header(None, alias="x-learner-id"),
) -> Response:
    tenant_id = tenant_id_h or tenant_id_q
    learner_id = learner_id_h or learner_id_q
    """Serve the picture for ``concept``.

    * Flag on  + cache hit  → PNG bytes from disk.
    * Flag on  + cache miss → generate via LiteLLM, cache, return PNG.
    * Flag off OR generation fails → 302 to Twemoji CDN equivalent.
    """
    twemoji_fallback = _twemoji_url_for(concept)

    if not is_enabled():
        if twemoji_fallback:
            return RedirectResponse(url=twemoji_fallback, status_code=302)
        raise HTTPException(status_code=404, detail="no image for concept")

    chosen_model = model or DEFAULT_MODEL
    expected_key = compute_cache_key(concept, model=chosen_model, style=style)

    # ETag short-circuit (content-addressed by cache key).
    if_none_match = request.headers.get("if-none-match")
    if if_none_match and if_none_match.strip('"') == expected_key:
        return Response(status_code=304, headers={"ETag": f'"{expected_key}"'})

    try:
        data, key, cached = await get_or_generate_image_bytes(
            concept,
            model=chosen_model,
            style=style,
            tenant_id=tenant_id,
            learner_id=learner_id,
        )
    except ImageGenerationDisabled:
        if twemoji_fallback:
            return RedirectResponse(url=twemoji_fallback, status_code=302)
        raise HTTPException(status_code=404, detail="image generation disabled")
    except ImageGenerationBlocked as exc:
        # Safety pre-check rejected the concept. We deliberately DO NOT
        # fall back to Twemoji here for blocks that look like people —
        # the explicit 422 makes the upstream pipeline notice and audit
        # the offending concept instead of silently masking it.
        logger.info("baseline_image.blocked concept=%r reason=%s", concept, exc)
        raise HTTPException(status_code=422, detail=f"concept blocked: {exc}")
    except BudgetExceeded as exc:
        # Tenant is past their daily LLM cap. Serve Twemoji so the
        # learner still sees a picture, but return 402 metadata in the
        # log so finance/ops can see the soft-fail.
        logger.warning("baseline_image.budget_exceeded tenant=%s err=%s", tenant_id, exc)
        if twemoji_fallback:
            return RedirectResponse(url=twemoji_fallback, status_code=302)
        raise HTTPException(status_code=402, detail="tenant budget exceeded")
    except ImageGenerationFailed as exc:
        logger.warning("baseline_image.failed concept=%r err=%s", concept, exc)
        if twemoji_fallback:
            return RedirectResponse(url=twemoji_fallback, status_code=302)
        raise HTTPException(status_code=502, detail="image generation failed")

    headers = {
        "ETag": f'"{key}"',
        # Long cache: the content is immutable for a given (concept, model, style).
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Baseline-Image-Cache": "hit" if cached else "miss",
    }
    return Response(content=data, media_type="image/png", headers=headers)

