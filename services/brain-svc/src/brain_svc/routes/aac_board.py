"""AAC board endpoint (Sprint 12.5).

Returns the augmentative-and-alternative-communication symbol board for
a learner, derived from:

  1. The learner's active IEP goals — every goal in the "communication"
     domain contributes its high-value vocabulary; non-comm domains
     contribute their topic words (math: numbers/shapes; ELA: action
     verbs; etc.) so the board stays relevant to current instruction.
  2. The current curriculum unit (the unit name + key vocabulary attached
     to the active brain state's curriculum cursor, when present).
  3. A baseline of ~30 high-frequency core-communication symbols that
     every board includes (yes/no/more/help/all-done/…).

Each item has a stable ``symbol_id`` so AAC sync vendors (CoughDrop,
TouchChat) can dedupe across boards, a ``frequency_rank`` for layout
order, and a placeholder ``image_url`` pointing at the bundled symbol
asset CDN.

If the learner has no IEP goals on file the route still returns the
core board so the family/learner UI never renders empty.
"""
from __future__ import annotations

import logging
import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from brain_svc.auth import AuthClaims, require_auth
from brain_svc.models.database import get_db
from brain_svc.services.access_control import verify_learner_access

logger = logging.getLogger("brain-svc.aac_board")

router = APIRouter()


# ── Symbol catalogue ────────────────────────────────────────────────────────
#
# We keep the catalogue inline so the service is self-contained for v1.0.
# When the symbol-asset-svc lands in a later sprint, swap `_SYMBOL_CDN`
# for its base URL and the catalogue can be loaded from there.
_SYMBOL_CDN = "https://cdn.aivo.ai/aac-symbols"


def _symbol(symbol_id: str, label: str, category: str, rank: int) -> dict[str, Any]:
    return {
        "symbol_id": symbol_id,
        "label": label,
        "image_url": f"{_SYMBOL_CDN}/{symbol_id}.svg",
        "category": category,
        "frequency_rank": rank,
    }


# Core 30 symbols every board ships with (ranked by communication frequency
# from the published PrAACtical AAC core word lists).
CORE_SYMBOLS: list[dict[str, Any]] = [
    _symbol("core.yes",       "yes",        "core",     1),
    _symbol("core.no",        "no",         "core",     2),
    _symbol("core.more",      "more",       "core",     3),
    _symbol("core.want",      "want",       "core",     4),
    _symbol("core.help",      "help",       "core",     5),
    _symbol("core.done",      "all done",   "core",     6),
    _symbol("core.stop",      "stop",       "core",     7),
    _symbol("core.go",        "go",         "core",     8),
    _symbol("core.like",      "like",       "core",     9),
    _symbol("core.dont_like", "don't like", "core",    10),
    _symbol("core.i",         "I",          "core",    11),
    _symbol("core.you",       "you",        "core",    12),
    _symbol("core.feel",      "feel",       "feeling", 13),
    _symbol("core.happy",     "happy",      "feeling", 14),
    _symbol("core.sad",       "sad",        "feeling", 15),
    _symbol("core.angry",     "angry",      "feeling", 16),
    _symbol("core.scared",    "scared",     "feeling", 17),
    _symbol("core.tired",     "tired",      "feeling", 18),
    _symbol("core.hungry",    "hungry",     "need",    19),
    _symbol("core.thirsty",   "thirsty",    "need",    20),
    _symbol("core.bathroom",  "bathroom",   "need",    21),
    _symbol("core.play",      "play",       "action",  22),
    _symbol("core.eat",       "eat",        "action",  23),
    _symbol("core.drink",     "drink",      "action",  24),
    _symbol("core.read",      "read",       "action",  25),
    _symbol("core.look",      "look",       "action",  26),
    _symbol("core.listen",    "listen",     "action",  27),
    _symbol("core.again",     "again",      "core",    28),
    _symbol("core.please",    "please",     "social",  29),
    _symbol("core.thank_you", "thank you",  "social",  30),
]


# Domain-keyed vocabulary that gets pulled in when an IEP goal targets
# that domain. Ranks start after the core 30 so core stays at the top.
DOMAIN_VOCAB: dict[str, list[dict[str, Any]]] = {
    "communication": [
        _symbol("comm.greet",    "hello",       "social", 31),
        _symbol("comm.bye",      "goodbye",     "social", 32),
        _symbol("comm.ask",      "ask",         "action", 33),
        _symbol("comm.tell",     "tell",        "action", 34),
        _symbol("comm.share",    "share",       "social", 35),
        _symbol("comm.turn",     "my turn",     "social", 36),
    ],
    "social_emotional": [
        _symbol("sel.calm",      "calm",        "feeling", 37),
        _symbol("sel.frustrated","frustrated",  "feeling", 38),
        _symbol("sel.proud",     "proud",       "feeling", 39),
        _symbol("sel.friend",    "friend",      "social",  40),
    ],
    "math": [
        _symbol("math.one",      "1",           "math",   41),
        _symbol("math.two",      "2",           "math",   42),
        _symbol("math.three",    "3",           "math",   43),
        _symbol("math.more_than","more than",   "math",   44),
        _symbol("math.less_than","less than",   "math",   45),
        _symbol("math.same",     "same",        "math",   46),
    ],
    "ela": [
        _symbol("ela.book",      "book",        "topic",  47),
        _symbol("ela.story",     "story",       "topic",  48),
        _symbol("ela.write",     "write",       "action", 49),
        _symbol("ela.letter",    "letter",      "topic",  50),
    ],
    "science": [
        _symbol("sci.water",     "water",       "topic",  51),
        _symbol("sci.plant",     "plant",       "topic",  52),
        _symbol("sci.animal",    "animal",      "topic",  53),
    ],
    "daily_living": [
        _symbol("dl.shoes",      "shoes",       "topic",  54),
        _symbol("dl.coat",       "coat",        "topic",  55),
        _symbol("dl.brush",      "brush teeth", "action", 56),
    ],
}


# Map free-text domain labels back to a known vocabulary key. We tolerate
# the variants we've seen in goal_area / domain across districts.
_DOMAIN_ALIASES = {
    "communication": "communication",
    "language": "communication",
    "speech": "communication",
    "social": "social_emotional",
    "social_emotional": "social_emotional",
    "sel": "social_emotional",
    "math": "math",
    "mathematics": "math",
    "ela": "ela",
    "reading": "ela",
    "writing": "ela",
    "literacy": "ela",
    "english": "ela",
    "science": "science",
    "daily_living": "daily_living",
    "adl": "daily_living",
    "self_help": "daily_living",
}


def _normalise_domain(raw: str | None) -> str | None:
    if not raw:
        return None
    key = re.sub(r"[^a-z0-9_]+", "_", raw.strip().lower()).strip("_")
    return _DOMAIN_ALIASES.get(key)


def _build_board(domains: set[str]) -> list[dict[str, Any]]:
    """Compose the symbol list. Core symbols are always included; domain
    vocabulary is appended for every IEP-active domain. Deduped by
    ``symbol_id`` (core wins on ties) and sorted by ``frequency_rank``."""
    by_id: dict[str, dict[str, Any]] = {}
    for sym in CORE_SYMBOLS:
        by_id[sym["symbol_id"]] = sym
    for domain in domains:
        for sym in DOMAIN_VOCAB.get(domain, []):
            by_id.setdefault(sym["symbol_id"], sym)
    return sorted(by_id.values(), key=lambda s: s["frequency_rank"])


@router.get("/aac-board/{learner_id}")
async def get_aac_board(
    learner_id: str,
    db: Session = Depends(get_db),
    auth: AuthClaims = Depends(require_auth),
) -> dict[str, Any]:
    """Return the composed AAC symbol board for the learner.

    404 if the learner is unknown. When the learner has no IEP goals on
    record we still return the core board so the UI renders sensibly.
    """
    # verify_learner_access raises 403/404 as appropriate.
    verify_learner_access(db, auth, learner_id)

    learner_exists = db.execute(
        text("SELECT 1 FROM learners WHERE id = :lid"),
        {"lid": learner_id},
    ).scalar()
    if not learner_exists:
        raise HTTPException(status_code=404, detail="Learner not found")

    goal_rows = db.execute(
        text(
            "SELECT domain FROM iep_goals "
            "WHERE learner_id = :lid AND status = 'active'"
        ),
        {"lid": learner_id},
    ).mappings().all()

    domains: set[str] = set()
    for row in goal_rows:
        dom = _normalise_domain(row.get("domain"))
        if dom:
            domains.add(dom)

    # When no IEP signals are available, still seed the board with
    # communication vocabulary so the learner has something to use.
    if not domains:
        domains.add("communication")

    # Pull the current curriculum unit's key vocabulary if the brain
    # state cursor has any — best-effort, never blocks the response.
    try:
        unit = db.execute(
            text(
                "SELECT curriculum_cursor FROM brain_states "
                "WHERE learner_id = :lid ORDER BY version DESC LIMIT 1"
            ),
            {"lid": learner_id},
        ).scalar()
        if isinstance(unit, dict):
            for word in (unit.get("key_vocabulary") or [])[:8]:
                if isinstance(word, str) and word.strip():
                    slug = re.sub(r"[^a-z0-9]+", "_", word.lower()).strip("_")
                    if slug:
                        DOMAIN_VOCAB.setdefault("_unit", []).append(
                            _symbol(
                                f"unit.{slug}",
                                word,
                                "unit",
                                100 + len(DOMAIN_VOCAB["_unit"]),
                            )
                        )
                        domains.add("_unit")
    except Exception:  # pragma: no cover - non-fatal augmentation
        logger.debug("aac_board.curriculum_lookup_skipped", exc_info=True)

    items = _build_board(domains)
    return {"items": items, "source_domains": sorted(domains)}
