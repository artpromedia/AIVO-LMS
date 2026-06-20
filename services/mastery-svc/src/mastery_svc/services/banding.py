"""
θ → delivery grade-band placement — a faithful Python port of
``packages/scoring/src/delivery-level.ts`` (deliveryLevelFromTheta). The bands and
thresholds MUST stay identical to the TypeScript source so the model's placement
agrees with assessment-svc/learning-svc; do not re-tune them here.
"""
from __future__ import annotations

import math
import re

GRADE_BANDS: list[str] = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]

# Most-supported first: θ ≥ 0.4 → on grade (offset 0); −0.3..0.4 → 1 below;
# −1.0..−0.3 → 2 below; < −1.0 → 3 below. Mirrors THETA_OFFSETS in delivery-level.ts.
_THETA_OFFSETS: list[tuple[float, int]] = [
    (0.4, 0),
    (-0.3, 1),
    (-1.0, 2),
    (float("-inf"), 3),
]


def grade_band_index(band: str) -> int:
    return GRADE_BANDS.index(band)


def normalize_grade_band(value: str | None) -> str | None:
    """Minimal port of normalizeGradeBand — enough for enrolled-grade inputs."""
    if value is None:
        return None
    raw = str(value).strip().lower()
    if not raw:
        return None
    if raw in ("k", "0", "kindergarten", "pre-k", "prek"):
        return "K"
    m = re.match(r"^(?:grade|year|gr|g)?\s*(\d{1,2})(?:st|nd|rd|th)?$", raw)
    if m:
        n = int(m.group(1))
        if 1 <= n <= 12:
            return GRADE_BANDS[n]
        if n == 0:
            return "K"
    return None


def delivery_level_from_theta(theta: float, enrolled_band: str) -> str:
    """Map a θ to the delivery band, relative to enrolled grade, clamped to [K, enrolled]."""
    if not math.isfinite(theta):
        raise ValueError(f"delivery_level_from_theta: theta must be finite, got {theta}")
    if enrolled_band not in GRADE_BANDS:
        normalized = normalize_grade_band(enrolled_band)
        enrolled_band = normalized if normalized else "12"
    offset = next(o for (mn, o) in _THETA_OFFSETS if theta >= mn)
    idx = max(0, grade_band_index(enrolled_band) - offset)
    return GRADE_BANDS[idx]


def target_difficulty_for_p(p: float) -> str:
    """Suggested next-item difficulty from current mastery (low → easy, high → hard)."""
    if p >= 0.66:
        return "hard"
    if p >= 0.40:
        return "medium"
    return "easy"
