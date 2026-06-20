"""θ→band parity with packages/scoring/src/delivery-level.ts deliveryLevelFromTheta."""
import pytest

from mastery_svc.services.banding import (
    delivery_level_from_theta,
    target_difficulty_for_p,
)


@pytest.mark.parametrize(
    "theta,enrolled,expected",
    [
        # θ ≥ 0.4 → on grade (offset 0)
        (0.5, "5", "5"),
        (0.4, "5", "5"),
        # -0.3 ≤ θ < 0.4 → one band below
        (0.0, "5", "4"),
        (-0.3, "5", "4"),
        # -1.0 ≤ θ < -0.3 → two bands below
        (-0.5, "5", "3"),
        (-1.0, "5", "3"),
        # θ < -1.0 → three bands below
        (-2.0, "5", "2"),
        # clamp to K (never below kindergarten)
        (-2.0, "1", "K"),
        (-5.0, "K", "K"),
        # high ability never exceeds enrolled grade
        (3.0, "3", "3"),
    ],
)
def test_delivery_level_matches_ts_policy(theta, enrolled, expected):
    assert delivery_level_from_theta(theta, enrolled) == expected


def test_non_finite_theta_raises():
    with pytest.raises(ValueError):
        delivery_level_from_theta(float("nan"), "5")


def test_enrolled_band_aliases_normalize():
    # "Grade 5" / "5th" normalize to band 5.
    assert delivery_level_from_theta(0.5, "Grade 5") == "5"
    assert delivery_level_from_theta(0.5, "5th") == "5"


def test_target_difficulty_bands():
    assert target_difficulty_for_p(0.1) == "easy"
    assert target_difficulty_for_p(0.5) == "medium"
    assert target_difficulty_for_p(0.9) == "hard"
