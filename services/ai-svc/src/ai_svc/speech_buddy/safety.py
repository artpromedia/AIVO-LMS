"""Speech Buddy multi-layer safety filter.

Implements the policy in ``docs/products/speech-buddy/safety.md``:

  layer 1: regex blocklist (deterministic, always-on, fastest)
  layer 2: lightweight keyword classifier (deterministic; heuristic — real
           model adapter pluggable via ``set_classifier``)
  layer 3: LLM judge (pluggable; default = deterministic stub so tests run
           offline; production wires this to the moderation_client)

A hard flag suppresses the model output, returns the routed crisis script,
emits a ``speech_buddy.safety.flag.raised`` event, and pages comms-svc.
A soft flag returns the buddy text but still emits an event for audit.

The filter logs every decision (allow + flag) with a correlation id; raw
transcript text is never written to logs or traces — only category, layer,
and the correlation id.
"""
from __future__ import annotations

import logging
import re
import time
import uuid
from dataclasses import dataclass
from typing import Callable, Optional

from .types import SafetyFlag, SafetyFlagCategory, SafetyFlagSeverity

logger = logging.getLogger("ai-svc.speech_buddy.safety")

# ---------------------------------------------------------------------------
# Layer 1 — regex blocklist
#
# Patterns are intentionally broad on the child-input side (better to soft-
# stop and re-route than to miss a self-harm signal) and narrower on the
# buddy-output side (the buddy is generated from a constrained prompt).
# ---------------------------------------------------------------------------

_SELF_HARM = [
    # English
    r"\b(kill|hurt|cut|harm)\s+(myself|me)\b",
    r"\bi\s+(want|wanna|wish)\s+to\s+die\b",
    r"\bi\s+wanna\s+die\b",
    r"\bi\s+want\s+to\s+die\b",
    r"\bi\s+don'?t\s+want\s+to\s+(be\s+alive|live)\b",
    r"\bsuicid(e|al)\b",
    r"\bend\s+(my|it\s+all)\s*(life)?\b",
    r"\bself[\s-]?harm\b",
    # Spanish — covers tú/yo phrasings used by 6-15 year-olds
    r"\bquiero\s+(morir|morirme|matarme)\b",
    r"\bme\s+quiero\s+(morir|matar)\b",
    r"\b(hacerme|hacer)\s+da[ñn]o\b",
    r"\bquiero\s+desaparecer\b",
    r"\bsuicid(io|a|arme)\b",
    r"\bno\s+quiero\s+(vivir|seguir\s+viviendo)\b",
]
_ABUSE = [
    # English
    r"\bsomeone\s+(at\s+home|at\s+school|in\s+my\s+family)\s+(hits|hurts|touches|beats)\s+me\b",
    r"\b(my\s+)?(dad|mom|mum|uncle|aunt|teacher|stepdad|stepmom|brother|sister)\s+(hits|hurts|beats|touches)\s+me\b",
    r"\b(an?\s+)?adult\s+touched\s+me\b",
    r"\bi'?m\s+(scared|afraid)\s+to\s+go\s+home\b",
    r"\b(no\s+one\s+feeds\s+me|i'?m\s+always\s+hungry\s+at\s+home)\b",
    # Spanish
    r"(mi\s+)?(pap[áa]|mam[áa]|t[íi]o|t[íi]a|padrastro|madrastra|hermano|hermana|maestro|maestra)\s+me\s+(peg[aoó]\w*|golpe[aoó]\w*|toc[aoó]\w*|lastim[aoó]\w*)",
    r"\bun\s+adulto\s+me\s+toc[óo]\b",
    r"\btengo\s+miedo\s+de\s+(ir|volver)\s+a\s+casa\b",
    r"\bnadie\s+me\s+da\s+de\s+comer\b",
]
_ROMANTIC_SEXUAL = [
    r"\b(sex|sexy|porn|naked|boobs?|penis|vagina|making\s+out)\b",
    r"\bbe\s+my\s+(boy|girl)friend\b",
    r"\bkiss\s+me\b",
    r"\b(date|dating)\s+you\b",
]
_VIOLENCE = [
    r"\b(kill|shoot|stab|punch|beat\s+up)\s+(him|her|them|you|someone)\b",
    r"\b(i\s+want\s+to\s+)?(hurt|attack)\s+(him|her|them)\b",
    r"\b(gun|knife|bomb|explosive|grenade)s?\b",
    r"\bblow\s+up\s+the\s+(school|house)\b",
]
_MEDICAL = [
    r"\bwhat\s+medicine\s+should\s+i\s+(take|use)\b",
    r"\bdo\s+i\s+have\s+(adhd|autism|depression|anxiety|cancer)\b",
    r"\bdiagnose\s+me\b",
    r"\bhow\s+much\s+(tylenol|ibuprofen|advil|melatonin)\s+(can|should)\s+i\s+take\b",
]
_PII = [
    # Address-ish / phone / SSN-ish / school-name fishing — broad on purpose.
    r"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b",                       # phone
    r"\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b",                         # SSN-ish
    r"\b\d{1,5}\s+\w+\s+(street|st|road|rd|avenue|ave|lane|ln|drive|dr|boulevard|blvd)\b",
    r"\b(my\s+(school|home)\s+address\s+is)\b",
    r"\b(my\s+phone\s+number\s+is)\b",
    r"\b(my\s+full\s+name\s+is)\b",
    r"\bsend\s+me\s+a\s+(photo|picture|pic)\s+of\s+(you|yourself)\b",
]
_JAILBREAK = [
    r"\b(ignore|forget|disregard)\s+(your|all|the)\s+(rules|guidelines|instructions|prompt|system)\b",
    r"\bignore\s+all\s+your\s+rules\b",
    r"\btell\s+me\s+anything\s+i\s+ask\b",
    r"\bpretend\s+(you|to\s+be)\s+(have|are)\s+(no\s+rules|a\s+different)\b",
    r"\bdeveloper\s+mode\b",
    r"\bjailbreak\b",
    r"\bDAN\s+mode\b",
    r"\bact\s+as\s+(if\s+you\s+are\s+)?(an?\s+)?(adult|unfiltered|uncensored)\b",
    r"\bforget\s+(you'?re|that\s+you\s+are)\s+speech\s+buddy\b",
]

_REGEX_TABLE: tuple[tuple[SafetyFlagCategory, list[re.Pattern[str]]], ...] = (
    ("self_harm",        [re.compile(p, re.I) for p in _SELF_HARM]),
    ("abuse_disclosure", [re.compile(p, re.I) for p in _ABUSE]),
    ("romantic_sexual",  [re.compile(p, re.I) for p in _ROMANTIC_SEXUAL]),
    ("violence",         [re.compile(p, re.I) for p in _VIOLENCE]),
    ("medical_advice",   [re.compile(p, re.I) for p in _MEDICAL]),
    ("pii",              [re.compile(p, re.I) for p in _PII]),
    ("jailbreak",        [re.compile(p, re.I) for p in _JAILBREAK]),
)

# ---------------------------------------------------------------------------
# Routed responses — verbatim from docs/products/speech-buddy/safety.md.
#
# self_harm + abuse_disclosure share the crisis script and end the session.
# Other categories return a redirect line and let the orchestrator pick a
# fresh scenario.
# ---------------------------------------------------------------------------

CRISIS_SCRIPT_EN = (
    "I hear you, and I'm really glad you told me. You don't have to talk to me "
    "alone about this. I'm telling a grown-up who cares about you so they can "
    "help. If you ever feel unsafe, you can also call or text a helpline — "
    "your grown-up will know one for where you live."
)
CRISIS_SCRIPT_ES = (
    "Te escucho, y me alegra mucho que me lo hayas contado. No tienes que "
    "hablar de esto sola/o conmigo. Le voy a contar a una persona adulta que "
    "te cuida para que pueda ayudarte. Si alguna vez te sientes en peligro, "
    "también puedes llamar o enviar un mensaje a una línea de ayuda — tu "
    "persona adulta sabrá cuál hay donde vives."
)

_REDIRECT_RESPONSES_EN: dict[SafetyFlagCategory, str] = {
    "self_harm": CRISIS_SCRIPT_EN,
    "abuse_disclosure": CRISIS_SCRIPT_EN,
    "romantic_sexual": "That's not something Speech Buddy talks about. Want to pick a different scenario?",
    "violence":        "Speech Buddy doesn't go into scary stuff like that. Let's pick something else.",
    "medical_advice":  "I'm not the right helper for that. A grown-up or a doctor is. Want to keep practising our scenario?",
    "pii":             "Let's keep that to ourselves. I don't need it to play together.",
    "jailbreak":       "I'm just Speech Buddy. Want to keep practising?",
}
_REDIRECT_RESPONSES_ES: dict[SafetyFlagCategory, str] = {
    "self_harm": CRISIS_SCRIPT_ES,
    "abuse_disclosure": CRISIS_SCRIPT_ES,
    "romantic_sexual": "Eso no es algo de lo que Speech Buddy hable. ¿Quieres elegir otra escena?",
    "violence":        "Speech Buddy no entra en cosas tan asustadizas. Vamos a elegir otra cosa.",
    "medical_advice":  "No soy la ayuda correcta para eso. Una persona adulta o un médico sí. ¿Seguimos practicando la escena?",
    "pii":             "Eso lo guardamos para nosotros. No lo necesito para jugar juntos.",
    "jailbreak":       "Yo solo soy Speech Buddy. ¿Seguimos practicando?",
}

HARD_CATEGORIES: frozenset[SafetyFlagCategory] = frozenset({
    "self_harm",
    "abuse_disclosure",
})
"""Categories that always escalate to severity=hard and end the session."""


def routed_response(category: SafetyFlagCategory, locale: str = "en") -> str:
    table = _REDIRECT_RESPONSES_ES if (locale or "en").lower().startswith("es") else _REDIRECT_RESPONSES_EN
    return table.get(category, table["jailbreak"])


# ---------------------------------------------------------------------------
# Layer 2 — keyword classifier (heuristic; pluggable)
# ---------------------------------------------------------------------------

_CLASSIFIER_KEYWORDS: dict[SafetyFlagCategory, tuple[str, ...]] = {
    "self_harm": ("hopeless", "worthless", "give up on life", "no point in living"),
    "abuse_disclosure": ("hits me", "hurts me", "touched me", "scared at home"),
    "romantic_sexual": ("sext", "nudes", "hookup"),
    "violence": ("hate them so much i", "wish they were dead"),
    "medical_advice": ("prescription", "overdose", "self-medicate"),
    "pii": ("zip code is", "social security"),
    "jailbreak": ("system prompt", "override safety", "no restrictions"),
}

ClassifierFn = Callable[[str], Optional[SafetyFlagCategory]]


def _default_classifier(text: str) -> Optional[SafetyFlagCategory]:
    low = text.lower()
    for category, kws in _CLASSIFIER_KEYWORDS.items():
        for kw in kws:
            if kw in low:
                return category
    return None


# ---------------------------------------------------------------------------
# Layer 3 — LLM judge (pluggable; default = deterministic stub)
# ---------------------------------------------------------------------------

JudgeFn = Callable[[str, str], Optional[SafetyFlagCategory]]


def _default_judge(text: str, source: str) -> Optional[SafetyFlagCategory]:
    """Default LLM-judge stub: catches obvious paraphrases the regex+classifier missed.

    Production deployments wire this to ``services.moderation_client``.
    The stub stays deterministic so the red-team test suite runs offline.
    """
    low = text.lower()
    # Obvious paraphrases not covered by regex/classifier.
    if "want to disappear forever" in low or "stop existing" in low:
        return "self_harm"
    if "an adult is doing things to me" in low:
        return "abuse_disclosure"
    if "show me how to make a weapon" in low:
        return "violence"
    return None


# ---------------------------------------------------------------------------
# Filter
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class SafetyDecision:
    allowed: bool
    flag: Optional[SafetyFlag]
    routed_text: Optional[str]
    """If allowed=False, the verbatim safe-redirect / crisis-script text."""
    layer_latency_ms: dict[str, float]
    """Per-layer wall-clock for tracing — used by the latency tests."""


class SafetyFilter:
    """Three-layer safety filter; thread-safe (stateless)."""

    def __init__(
        self,
        *,
        classifier: ClassifierFn = _default_classifier,
        judge: JudgeFn = _default_judge,
        emit: Optional[Callable[[SafetyFlag, str], None]] = None,
    ) -> None:
        self._classifier = classifier
        self._judge = judge
        self._emit = emit

    def set_classifier(self, fn: ClassifierFn) -> None:
        self._classifier = fn

    def set_judge(self, fn: JudgeFn) -> None:
        self._judge = fn

    def set_emit(self, fn: Callable[[SafetyFlag, str], None]) -> None:
        self._emit = fn

    def check(
        self,
        text: str,
        *,
        source: str,                # "child_input" | "buddy_output"
        locale: str = "en",
        correlation_id: Optional[str] = None,
        session_id: str = "",
    ) -> SafetyDecision:
        cid = correlation_id or uuid.uuid4().hex
        latencies: dict[str, float] = {}

        # --- layer 1: regex ---------------------------------------------------
        t0 = time.perf_counter()
        regex_hit = self._regex_check(text)
        latencies["regex"] = (time.perf_counter() - t0) * 1000.0
        if regex_hit is not None:
            return self._flag(regex_hit, "regex", source, locale, cid, session_id, latencies)

        # --- layer 2: classifier ---------------------------------------------
        t0 = time.perf_counter()
        classifier_hit = self._classifier(text)
        latencies["classifier"] = (time.perf_counter() - t0) * 1000.0
        if classifier_hit is not None:
            return self._flag(classifier_hit, "classifier", source, locale, cid, session_id, latencies)

        # --- layer 3: LLM judge ----------------------------------------------
        t0 = time.perf_counter()
        judge_hit = self._judge(text, source)
        latencies["llm_judge"] = (time.perf_counter() - t0) * 1000.0
        if judge_hit is not None:
            return self._flag(judge_hit, "llm_judge", source, locale, cid, session_id, latencies)

        # Clean — log the allow with correlation id only (no transcript text).
        logger.info(
            "speech_buddy.safety.allow",
            extra={
                "correlation_id": cid,
                "session_id": session_id,
                "source": source,
                "layer_latency_ms": latencies,
            },
        )
        return SafetyDecision(
            allowed=True,
            flag=None,
            routed_text=None,
            layer_latency_ms=latencies,
        )

    # -- internals ------------------------------------------------------------

    def _regex_check(self, text: str) -> Optional[SafetyFlagCategory]:
        for category, patterns in _REGEX_TABLE:
            for p in patterns:
                if p.search(text):
                    return category
        return None

    def _flag(
        self,
        category: SafetyFlagCategory,
        layer: str,
        source: str,
        locale: str,
        cid: str,
        session_id: str,
        latencies: dict[str, float],
    ) -> SafetyDecision:
        severity: SafetyFlagSeverity = "hard" if category in HARD_CATEGORIES else "soft"
        # romantic_sexual / violence / jailbreak escalate to hard on repeat —
        # caller is responsible for tracking repeats per session. We mark them
        # soft on first hit; the orchestrator promotes them to hard if the
        # session has seen ≥2 of the same category already.
        flag = SafetyFlag(
            correlation_id=cid,
            category=category,
            severity=severity,
            source=source,  # type: ignore[arg-type]
            layer=layer,    # type: ignore[arg-type]
            raised_at=_iso_now(),
        )
        logger.warning(
            "speech_buddy.safety.flag",
            extra={
                "correlation_id": cid,
                "session_id": session_id,
                "category": category,
                "severity": severity,
                "source": source,
                "layer": layer,
                "layer_latency_ms": latencies,
            },
        )
        if self._emit is not None:
            try:
                self._emit(flag, session_id)
            except Exception:  # never let the emit hook break the safety path
                logger.exception("speech_buddy.safety.emit_failed")

        return SafetyDecision(
            allowed=False,
            flag=flag,
            routed_text=routed_response(category, locale),
            layer_latency_ms=latencies,
        )


def _iso_now() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


__all__ = [
    "ClassifierFn",
    "CRISIS_SCRIPT_EN",
    "CRISIS_SCRIPT_ES",
    "HARD_CATEGORIES",
    "JudgeFn",
    "SafetyDecision",
    "SafetyFilter",
    "routed_response",
]
