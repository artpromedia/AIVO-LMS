"""readability_grade must understand both legacy word-ordinals and the
canonical grade bands curriculum_alignment now carries (Sprint 2)."""

import pytest

from ai_svc.services.quality_gate import READABILITY_GRADE_MAP, readability_grade


@pytest.mark.parametrize("legacy,expected", list(READABILITY_GRADE_MAP.items()))
def test_legacy_word_ordinals_still_resolve(legacy: str, expected: int):
    assert readability_grade(legacy) == expected


@pytest.mark.parametrize(
    "band,expected",
    [
        ("K", 1),
        ("k", 1),
        ("0", 1),
        ("1", 2),
        ("2", 3),
        ("3", 4),
        ("4", 5),
        ("5", 6),
        ("6", 7),
        ("8", 7),
        ("12", 7),
    ],
)
def test_canonical_bands_resolve(band: str, expected: int):
    assert readability_grade(band) == expected


def test_unknown_values_use_midband_tier():
    assert readability_grade("not-a-grade") == 4
    assert readability_grade(None) == 4
    assert readability_grade("") == 4
