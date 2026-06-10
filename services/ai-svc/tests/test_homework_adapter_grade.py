"""Grade anchoring for homework adaptation (adaptive-learning E2E Sprint 2).

The adapter must anchor to the learner's baseline-derived delivery_level,
fall back to the enrolled grade_band, and NEVER substitute a hardcoded
grade ("THIRD" was the old silent default) when the alignment is empty.
"""

from unittest.mock import AsyncMock, patch

import pytest

from ai_svc.vision.homework_adapter import adapt_homework

_PROBLEMS = [{"number": 1, "problem_text": "What is 3/4 + 1/8?"}]

_LLM_RESPONSE = {
    "content": (
        '{"problems": [{"number": 1, "original": "What is 3/4 + 1/8?", '
        '"adapted": "adapted", "scaffolding": "", "accommodation_notes": "", '
        '"visual_supports": [], "choices": [], "parent_guide": ""}], '
        '"parent_guide": "", "estimated_minutes": 10}'
    )
}


def _brain_context(alignment: dict | None) -> dict:
    return {
        "functioning_level_profile": {"level": "STANDARD"},
        "disability_signals": {"communication_mode": "verbal"},
        "curriculum_alignment": alignment,
        "active_accommodations": [],
    }


async def _run_and_capture_prompt(alignment: dict | None) -> str:
    with patch(
        "ai_svc.vision.homework_adapter.generate_completion",
        new=AsyncMock(return_value=_LLM_RESPONSE),
    ) as mock_gen:
        await adapt_homework(_PROBLEMS, _brain_context(alignment), subject="math")
        return mock_gen.call_args.kwargs["user_prompt"]


@pytest.mark.asyncio
async def test_prefers_baseline_delivery_level():
    prompt = await _run_and_capture_prompt(
        {"grade_band": "5", "delivery_level": "3", "delivery_level_source": "baseline_theta"}
    )
    assert "Grade Level: 3" in prompt


@pytest.mark.asyncio
async def test_falls_back_to_enrolled_grade_band():
    prompt = await _run_and_capture_prompt({"grade_band": "5"})
    assert "Grade Level: 5" in prompt


@pytest.mark.asyncio
async def test_empty_alignment_never_defaults_to_a_grade():
    prompt = await _run_and_capture_prompt({})
    assert "THIRD" not in prompt
    assert "not specified" in prompt


@pytest.mark.asyncio
async def test_missing_alignment_key_never_defaults_to_a_grade():
    prompt = await _run_and_capture_prompt(None)
    assert "THIRD" not in prompt
    assert "not specified" in prompt
