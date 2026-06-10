import json
import re
import logging
import os
from datetime import datetime
from pathlib import Path

logger = logging.getLogger("ai-svc.quality_gate")

UNSAFE_PATTERN_CATEGORIES: dict[str, list[str]] = {
    "violence_weapons": [
        r"(?i)\b(kill|murder|assassinate|behead|stab|shoot|shooting|massacre|torture|maim|mutilate)\b",
        r"(?i)\b(weapon|gun|rifle|pistol|firearm|bomb|explosive|grenade|knife|blade)\b",
        r"(?i)\b(terrorist|terrorism|hostage|kidnap|abduct)\b",
    ],
    "self_harm": [
        r"(?i)\b(suicide|suicidal|self.?harm|cutting myself|hurt myself)\b",
        r"(?i)\b(anorexia|bulimia|eating disorder|starve myself)\b",
        r"(?i)\b(overdose|hang myself|jump off)\b",
    ],
    "substance_abuse": [
        r"(?i)\b(cocaine|heroin|meth|methamphetamine|fentanyl|ecstasy|mdma|lsd|crack|opioid)\b",
        r"(?i)\b(weed|marijuana|cannabis|bong|joint|blunt|stoned|high)\b",
        r"(?i)\b(alcohol|drunk|wasted|beer|liquor|vodka|whiskey)\b",
        r"(?i)\b(vape|vaping|e.?cigarette|nicotine|cigarette|smoking|tobacco)\b",
        r"(?i)\b(drug deal|getting high|score some)\b",
    ],
    "sexual_content": [
        r"(?i)\b(sex|sexual|nude|naked|porn|pornography|xxx|erotic|orgasm|masturbat)\b",
        r"(?i)\b(genital|penis|vagina|breast|boob|nipple)\b",
        r"(?i)\b(prostitut|escort|stripper|brothel)\b",
    ],
    "romantic_dating": [
        r"(?i)\b(dating|hook.?up|make out|making out|french kiss|sleep with|have sex)\b",
        r"(?i)\b(boyfriend|girlfriend) (touched|kissed|undressed)\b",
    ],
    "hate_harassment": [
        r"(?i)\b(racist|racism|slur|bigot|homophobe|homophobic|transphobe|transphobic|antisemit)\b",
        r"(?i)\b(retard|retarded|spaz|cripple|midget)\b",
        r"(?i)\b(hate|hateful|despicable|worthless|disgusting) (you|him|her|them|those)\b",
    ],
    "bullying": [
        r"(?i)\b(stupid|idiot|moron|loser|dumb|fat|ugly|freak)\b",
        r"(?i)\b(nobody likes you|kill yourself|kys|go die|shut up)\b",
        r"(?i)\b(you're (so |a |an )?(stupid|dumb|worthless|useless|pathetic))\b",
    ],
    "profanity": [
        r"(?i)\b(fuck|fucking|fucked|shit|bitch|bastard|asshole|dick|piss|crap|damn|hell)\b",
        r"(?i)\b(motherfucker|cocksucker|son of a bitch|sob)\b",
    ],
    "dangerous_activities": [
        r"(?i)\bdangerous chemicals?\b",
        r"(?i)\b(make a bomb|build a bomb|how to (poison|hack|steal))\b",
        r"(?i)\b(arson|set fire to|burn down)\b",
    ],
    "gambling": [
        r"(?i)\b(gamble|gambling|casino|betting|wager|lottery scam)\b",
    ],
}

PII_PATTERNS: dict[str, str] = {
    "ssn": r"\b\d{3}-\d{2}-\d{4}\b",
    "phone_us": r"\b(?:\+?1[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}\b",
    "phone_short": r"\b\d{3}-\d{4}\b",
    "email": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
    "credit_card": r"\b(?:\d[ -]*?){13,16}\b",
    "ip_address": r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b",
    "street_address": r"\b\d{1,5}\s+\w+(?:\s+\w+){0,3}\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr)\b",
}

UNSAFE_PATTERNS: list[str] = [p for patterns in UNSAFE_PATTERN_CATEGORIES.values() for p in patterns]

READABILITY_GRADE_MAP = {
    "PRE_K": 0,
    "KINDERGARTEN": 1,
    "FIRST": 2,
    "SECOND": 3,
    "THIRD": 4,
    "FOURTH": 5,
    "FIFTH": 6,
    "SIXTH_PLUS": 7,
}


def readability_grade(delivery_level: str | None) -> int:
    """Resolve a delivery level to a readability tier.

    Accepts both the legacy word-ordinal keys (READABILITY_GRADE_MAP) and the
    canonical grade bands curriculum_alignment now carries ("K", "1".."12").
    Unknown values log a warning and use the mid-band tier — readability
    scoring is a guardrail, not a generator, so degrading here is safe but
    must be visible.
    """
    key = (delivery_level or "").strip().upper()
    if key in READABILITY_GRADE_MAP:
        return READABILITY_GRADE_MAP[key]
    if key in ("K", "0"):
        return READABILITY_GRADE_MAP["KINDERGARTEN"]
    if key.isdigit():
        n = int(key)
        if 1 <= n <= 5:
            return n + 1  # grade 1 → FIRST(2) … grade 5 → FIFTH(6)
        if n >= 6:
            return READABILITY_GRADE_MAP["SIXTH_PLUS"]
    logger.warning(
        "quality_gate: unknown delivery_level %r; using mid-band readability tier",
        delivery_level,
    )
    return 4


MODERATION_LOG_PATH = Path(
    os.environ.get("CONTENT_MODERATION_LOG", "/tmp/aivo_content_moderation.log")
)


def _log_moderation_event(event: dict) -> None:
    try:
        MODERATION_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        event = {**event, "logged_at": datetime.utcnow().isoformat() + "Z"}
        with MODERATION_LOG_PATH.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(event) + "\n")
    except Exception as exc:
        logger.warning("Failed to write moderation log: %s", exc)


def run_quality_gate(
    content: str,
    delivery_level: str,
    functioning_level: str,
    sensory_profile: dict | None = None,
    accommodations: list[str] | None = None,
    *,
    tutor_sku: str | None = None,
    model_used: str | None = None,
    learner_id: str | None = None,
    tenant_id: str | None = None,
    session_id: str | None = None,
    content_type: str = "ai_response",
) -> dict:
    gates = []

    safety_result = _gate_safety(content)
    gates.append(safety_result)

    pii_result = _gate_pii(content)
    gates.append(pii_result)

    readability_result = _gate_readability(content, delivery_level)
    gates.append(readability_result)

    compliance_result = _gate_compliance(content, functioning_level, sensory_profile, accommodations)
    gates.append(compliance_result)

    passed = all(g["passed"] for g in gates)
    score = sum(g["score"] for g in gates) / len(gates)

    # Persist moderation events: failures, PII leaks, and low-confidence passes.
    try:
        from .moderation_client import log_moderation_event

        if not safety_result["passed"]:
            log_moderation_event(
                content=content, flag_reason="safety_regex", content_type=content_type,
                flag_confidence=0.95, gate_results={"gates": gates},
                tutor_sku=tutor_sku, model_used=model_used,
                learner_id=learner_id, tenant_id=tenant_id, session_id=session_id,
                status="PENDING",
            )
        elif not pii_result["passed"]:
            log_moderation_event(
                content=content, flag_reason="pii_leak", content_type=content_type,
                flag_confidence=0.99, gate_results={"gates": gates},
                tutor_sku=tutor_sku, model_used=model_used,
                learner_id=learner_id, tenant_id=tenant_id, session_id=session_id,
                status="PENDING",
            )
        elif not passed:
            log_moderation_event(
                content=content, flag_reason="quality_gate_failure", content_type=content_type,
                flag_confidence=round(1.0 - score, 3), gate_results={"gates": gates},
                tutor_sku=tutor_sku, model_used=model_used,
                learner_id=learner_id, tenant_id=tenant_id, session_id=session_id,
                status="PENDING",
            )
        elif score < 0.7:
            # Passed but borderline — queue for periodic batch review,
            # the AI response is still delivered to the learner.
            log_moderation_event(
                content=content, flag_reason="low_confidence_pass", content_type=content_type,
                flag_confidence=round(1.0 - score, 3), gate_results={"gates": gates},
                tutor_sku=tutor_sku, model_used=model_used,
                learner_id=learner_id, tenant_id=tenant_id, session_id=session_id,
                status="LOW_CONFIDENCE",
            )
    except Exception as exc:
        logger.warning("moderation_client logging failed: %s", exc)

    if not passed:
        _log_moderation_event({
            "passed": False,
            "score": round(score, 2),
            "delivery_level": delivery_level,
            "functioning_level": functioning_level,
            "failed_gates": [g["gate"] for g in gates if not g["passed"]],
            "details": [g for g in gates if not g["passed"]],
            "content_preview": content[:300],
        })

    return {
        "passed": passed,
        "score": round(score, 2),
        "gates": gates,
    }


async def run_semantic_safety(content: str) -> dict:
    """Optional LLM-backed semantic moderation. Returns a gate-shaped dict.

    Used out-of-band by callers that have an event loop. The regex-based
    `run_quality_gate` is sync and remains the primary defense.
    """
    try:
        from .llm_gateway import generate_completion
    except Exception as exc:
        logger.warning("Semantic safety unavailable: %s", exc)
        return {"gate": "semantic_safety", "passed": True, "score": 1.0, "details": {"skipped": True}}

    system_prompt = (
        "You are a strict content safety moderator for a learning platform that "
        "serves children aged 3-18, including children with developmental "
        "differences and non-verbal learners who cannot self-report harmful "
        "content. Respond with EXACTLY one line: 'SAFE' or 'UNSAFE: <reason>'."
    )
    user_prompt = (
        "Is the following content safe for a child aged 3-18 with developmental "
        "differences? Reply SAFE or UNSAFE.\n\n---\n" + content[:4000] + "\n---"
    )

    try:
        result = await generate_completion(system_prompt, user_prompt, temperature=0.0, max_tokens=80)
        text = (result.get("content") or "").strip()
    except Exception as exc:
        logger.warning("Semantic safety call failed: %s", exc)
        return {"gate": "semantic_safety", "passed": True, "score": 1.0, "details": {"error": str(exc)}}

    upper = text.upper()
    if upper.startswith("UNSAFE"):
        reason = text.split(":", 1)[1].strip() if ":" in text else "unspecified"
        _log_moderation_event({
            "passed": False,
            "gate": "semantic_safety",
            "reason": reason,
            "content_preview": content[:300],
        })
        try:
            from .moderation_client import log_moderation_event
            log_moderation_event(
                content=content, flag_reason="semantic_unsafe",
                content_type="ai_response", flag_confidence=0.92,
                gate_results={"semantic_reason": reason}, status="PENDING",
            )
        except Exception as exc:
            logger.warning("semantic moderation log failed: %s", exc)
        return {"gate": "semantic_safety", "passed": False, "score": 0.0, "details": {"reason": reason}}
    return {"gate": "semantic_safety", "passed": True, "score": 1.0, "details": {}}


def _gate_safety(content: str) -> dict:
    violations: list[dict] = []
    for category, patterns in UNSAFE_PATTERN_CATEGORIES.items():
        for pattern in patterns:
            matches = re.findall(pattern, content)
            if matches:
                flat = [m if isinstance(m, str) else " ".join(m) for m in matches]
                violations.append({"category": category, "matches": flat})

    passed = len(violations) == 0
    return {
        "gate": "safety",
        "passed": passed,
        "score": 1.0 if passed else 0.0,
        "details": {"violations": violations} if violations else {},
    }


def _gate_pii(content: str) -> dict:
    leaks: list[dict] = []
    for kind, pattern in PII_PATTERNS.items():
        for match in re.findall(pattern, content):
            value = match if isinstance(match, str) else " ".join(match)
            if kind == "credit_card":
                digits = re.sub(r"\D", "", value)
                if len(digits) < 13 or len(digits) > 19:
                    continue
            leaks.append({"type": kind, "value": value})

    passed = len(leaks) == 0
    return {
        "gate": "pii_leak",
        "passed": passed,
        "score": 1.0 if passed else 0.0,
        "details": {"leaks": leaks} if leaks else {},
    }


def _gate_readability(content: str, delivery_level: str) -> dict:
    words = content.split()
    word_count = len(words)
    sentences = re.split(r"[.!?]+", content)
    sentence_count = max(len([s for s in sentences if s.strip()]), 1)

    avg_words_per_sentence = word_count / sentence_count
    avg_word_length = sum(len(w) for w in words) / max(word_count, 1)

    target_grade = readability_grade(delivery_level)

    if target_grade <= 2:
        max_avg_words = 8
        max_avg_word_length = 5
    elif target_grade <= 4:
        max_avg_words = 12
        max_avg_word_length = 6
    else:
        max_avg_words = 18
        max_avg_word_length = 7

    word_score = min(1.0, max_avg_words / max(avg_words_per_sentence, 1))
    length_score = min(1.0, max_avg_word_length / max(avg_word_length, 1))
    score = (word_score + length_score) / 2

    return {
        "gate": "readability",
        "passed": score >= 0.5,
        "score": round(score, 2),
        "details": {
            "avg_words_per_sentence": round(avg_words_per_sentence, 1),
            "avg_word_length": round(avg_word_length, 1),
            "target_grade": target_grade,
        },
    }


def _gate_compliance(
    content: str,
    functioning_level: str,
    sensory_profile: dict | None,
    accommodations: list[str] | None,
) -> dict:
    issues = []

    if functioning_level in ("LOW_VERBAL", "NON_VERBAL", "PRE_SYMBOLIC"):
        if len(content) > 2000:
            issues.append("Content too long for low-functioning level")
        sentences = re.split(r"[.!?]+", content)
        long_sentences = [s for s in sentences if len(s.split()) > 10]
        if len(long_sentences) > 3:
            issues.append("Too many long sentences for this functioning level")

    if sensory_profile:
        visual = sensory_profile.get("visual", "typical")
        if visual == "hyper":
            exclamation_count = content.count("!")
            if exclamation_count > 3:
                issues.append("Too many exclamation marks for visual hyper-sensitivity")

    passed = len(issues) == 0
    return {
        "gate": "compliance",
        "passed": passed,
        "score": 1.0 if passed else max(0.3, 1.0 - len(issues) * 0.2),
        "details": {"issues": issues} if issues else {},
    }
