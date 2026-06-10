"""Sprint 6 — therapist + caregiver-observation prompt blocks.

Pins: presence in BOTH prompt builders, multi-discipline rendering, therapy
goals without a formal assessment, note truncation, and graceful absence.
"""

from ai_svc.services.baseline_generator import (
    ADVENTURE_CHAPTERS,
    _format_caregiver_observations_block,
    _format_therapist_block,
    build_baseline_generation_prompt,
    build_discovery_adventure_prompt,
)

THERAPIST_SPEECH = {
    "therapyDiscipline": "speech",
    "areasOfFocus": ["articulation", "phonology"],
    "strengths": ["responds well to modeling"],
    "challenges": ["multi-syllable words"],
    "sensoryNotes": "Sensitive to loud playback.",
    "communicationNotes": "Uses AAC for novel words.",
    "regulationStrategies": ["first-then boards"],
    "recommendedAccommodations": ["extra response time"],
    "observations": "Great progress with /r/ blends this term.",
}

THERAPIST_OT = {
    "therapyDiscipline": "occupational",
    "areasOfFocus": ["fine motor"],
    "strengths": [],
    "challenges": ["pencil grip fatigue"],
    "observations": "",
}

GOALS = [
    {"goal": "Produce /r/ blends in 4 of 5 trials", "domain": "speech", "target": "80%"},
    {"goal": "Copy a 5-word sentence", "domain": "fine motor", "target": "legible"},
]

OBSERVATIONS = [
    {"category": "Homework", "mood": "frustrated", "notes": "Melted down over long word problems.", "date": "2026-06-01T00:00:00Z"},
    {"category": "General", "mood": None, "notes": "x" * 500, "date": "2026-06-02T00:00:00Z"},
]


class TestTherapistBlock:
    def test_absent_renders_explicit_optional_line(self):
        block = _format_therapist_block(None)
        assert "No therapist assessment on file (optional)" in block
        assert _format_therapist_block([]) == block

    def test_multi_discipline_renders_one_subblock_each(self):
        block = _format_therapist_block([THERAPIST_SPEECH, THERAPIST_OT])
        assert "### Speech therapist" in block
        assert "### Occupational therapist" in block
        assert "articulation" in block
        assert "pencil grip fatigue" in block
        assert "Sensitive to loud playback." in block

    def test_goals_render_without_a_formal_assessment(self):
        block = _format_therapist_block(None, GOALS)
        assert "Active Therapy Goals (target these domains explicitly)" in block
        assert "Produce /r/ blends" in block
        assert "domain: speech" in block

    def test_goals_render_alongside_assessments(self):
        block = _format_therapist_block([THERAPIST_SPEECH], GOALS)
        assert "### Speech therapist" in block
        assert "Active Therapy Goals" in block


class TestCaregiverObservationsBlock:
    def test_absent_renders_empty_string(self):
        assert _format_caregiver_observations_block(None) == ""
        assert _format_caregiver_observations_block([]) == ""
        assert _format_caregiver_observations_block([{"notes": ""}]) == ""

    def test_renders_notes_as_context_not_assessment(self):
        block = _format_caregiver_observations_block(OBSERVATIONS)
        assert "context, NOT assessment data" in block
        assert "Melted down over long word problems." in block
        assert "mood: frustrated" in block
        assert "[2026-06-01]" in block

    def test_truncates_long_notes(self):
        block = _format_caregiver_observations_block(OBSERVATIONS)
        assert "x" * 280 in block
        assert "x" * 281 not in block


BASE_KWARGS = {
    "parent_assessment": {
        "communicationMode": "verbal",
        "deviceInteraction": "independent",
        "responseMethod": "touch",
        "attentionSpan": "medium",
        "diagnoses": [],
        "responses": {},
        "functioningLevel": "STANDARD",
    },
}


class TestBothBuildersRenderTheBlocks:
    def test_baseline_prompt_includes_therapist_and_observations(self):
        system_prompt, user_prompt = build_baseline_generation_prompt(
            **BASE_KWARGS,
            therapist_assessments=[THERAPIST_SPEECH],
            therapy_goals=GOALS,
            caregiver_observations=OBSERVATIONS,
        )
        combined = system_prompt + user_prompt
        assert "### Speech therapist" in combined
        assert "Active Therapy Goals" in combined
        assert "Recent Caregiver Observations" in combined

    def test_discovery_prompt_includes_therapist_and_observations(self):
        chapter = ADVENTURE_CHAPTERS[0]
        system_prompt, user_prompt = build_discovery_adventure_prompt(
            **BASE_KWARGS,
            chapter=chapter,
            therapist_assessments=[THERAPIST_SPEECH, THERAPIST_OT],
            therapy_goals=GOALS,
            caregiver_observations=OBSERVATIONS,
        )
        combined = system_prompt + user_prompt
        assert "### Speech therapist" in combined
        assert "### Occupational therapist" in combined
        assert "Recent Caregiver Observations" in combined

    def test_builders_degrade_gracefully_when_absent(self):
        system_prompt, user_prompt = build_baseline_generation_prompt(**BASE_KWARGS)
        combined = system_prompt + user_prompt
        assert "No therapist assessment on file (optional)" in combined
        assert "Recent Caregiver Observations" not in combined
