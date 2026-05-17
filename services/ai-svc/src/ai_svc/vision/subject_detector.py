"""Subject classification from extracted homework content."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)

VALID_SUBJECTS = {"MATH", "ELA", "SCIENCE", "HISTORY", "CODING", "OTHER"}

SUBJECT_TO_SKU = {
    "MATH": "ADDON_TUTOR_MATH",
    "ELA": "ADDON_TUTOR_ELA",
    "SCIENCE": "ADDON_TUTOR_SCIENCE",
    "HISTORY": "ADDON_TUTOR_HISTORY",
    "CODING": "ADDON_TUTOR_CODING",
    "OTHER": None,
}

_SUBJECT_PATTERNS: dict[str, list[str]] = {
    "MATH": [
        r"\bequation\b", r"\bsolve\b", r"\bcalculate\b", r"\bx\s*=",
        r"\balgebra\b", r"\bfraction\b", r"\bmultipl", r"\bdivi[ds]",
        r"\bsubtract\b", r"\baddition\b", r"\bgeometr", r"\bangle\b",
        r"\btriangle\b", r"\bperimeter\b", r"\barea\b", r"\bvolume\b",
        r"\bpercent\b", r"\bdecimal\b", r"\bratio\b", r"\bproportion\b",
        r"\bpolynomial\b", r"\bsqrt\b", r"\\frac\{", r"\\times\b",
        r"\d+\s*[+\-*/×÷=]\s*\d+",
    ],
    "ELA": [
        r"\bread\b.*\b(passage|text|story)\b", r"\bwrite\b.*\b(essay|paragraph|sentence)\b",
        r"\bvocabulary\b", r"\bgrammar\b", r"\bcomprehension\b",
        r"\bspelling\b", r"\bsynonym\b", r"\bantonym\b",
        r"\bnarrative\b", r"\bauthor\b", r"\bmain idea\b",
        r"\bthesis\b", r"\btopic sentence\b", r"\bparagraph\b",
        r"\bpunctuat\b", r"\bnoun\b", r"\bverb\b", r"\badjective\b",
        r"\brhyme\b", r"\bpoem\b", r"\bpoetry\b",
        r"\bfiction\b", r"\bnonfiction\b",
    ],
    "SCIENCE": [
        r"\bexperiment\b", r"\bhypothesis\b", r"\bmolecule\b",
        r"\bcell\b.*\b(membrane|wall|organelle)\b", r"\benergy\b",
        r"\bphotosynthesis\b", r"\becosystem\b", r"\bhabitat\b",
        r"\bgravity\b", r"\bforce\b", r"\bvelocity\b",
        r"\bchemical\b", r"\breaction\b", r"\belement\b",
        r"\bperiodic table\b", r"\batom\b", r"\belectron\b",
        r"\bscientific method\b", r"\blab\b", r"\bobserv",
    ],
    "HISTORY": [
        r"\bhistory\b", r"\bwar\b", r"\bpresident\b",
        r"\bcentury\b", r"\bcivilization\b", r"\bempire\b",
        r"\bcoloni", r"\brevolution\b", r"\bindependence\b",
        r"\bconstitution\b", r"\bamendment\b", r"\bdemocra",
        r"\bcivil rights\b", r"\bworld war\b",
        r"\bancient\b", r"\bmedieval\b", r"\brenaissance\b",
    ],
    "CODING": [
        r"\bfunction\b.*\breturn\b", r"\bvariable\b",
        r"\bloop\b", r"\bif\s*\(", r"\bprint\s*\(",
        r"\balgorithm\b", r"\bpseudocode\b",
        r"\barray\b", r"\blist\b.*\bindex\b",
        r"\bboolean\b", r"\bdebug\b",
    ],
}

_HIGH_CONFIDENCE_THRESHOLD = 0.7
_AMBIGUOUS_THRESHOLD = 0.4


@dataclass
class DetectedSubject:
    subject: str
    confidence: float
    method: str
    required_sku: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "subject": self.subject,
            "confidence": self.confidence,
            "method": self.method,
            "required_sku": self.required_sku or SUBJECT_TO_SKU.get(self.subject),
        }


async def detect_subject(text: str) -> DetectedSubject:
    if not text or not text.strip():
        return DetectedSubject(subject="OTHER", confidence=0.0, method="pattern")

    scores = _score_patterns(text)

    if not scores:
        return DetectedSubject(subject="OTHER", confidence=0.0, method="pattern")

    sorted_scores = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    top_subject, top_score = sorted_scores[0]

    return DetectedSubject(
        subject=top_subject,
        confidence=min(1.0, top_score),
        method="pattern",
        required_sku=SUBJECT_TO_SKU.get(top_subject),
    )


def _score_patterns(text: str) -> dict[str, float]:
    text_lower = text.lower()
    scores: dict[str, float] = {}

    for subject, patterns in _SUBJECT_PATTERNS.items():
        match_count = 0
        for pattern in patterns:
            matches = re.findall(pattern, text_lower, re.IGNORECASE)
            match_count += len(matches)

        if match_count > 0:
            scores[subject] = min(1.0, match_count / (len(patterns) * 0.5))

    return scores
