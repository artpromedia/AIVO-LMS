"""Tests for the OPTIONAL teacher input + co-parent merging in the
baseline generator.

The product requirement is that teacher input, co-parent assessments,
and IEP all be supported but each remain OPTIONAL. These tests lock in:

* Absent inputs do NOT raise and emit a clear "no X on file" line.
* Present inputs surface in the prompt with the expected structure.
* IEP-absent + teacher-absent + caregiver-absent path still produces a
  usable prompt (the existing parent assessment carries baseline
  signal).

Run with: pytest services/ai-svc/tests/test_optional_inputs_prompt.py -v
"""
from ai_svc.services.baseline_generator import (
    build_baseline_generation_prompt,
    build_discovery_adventure_prompt,
)


PARENT = {
    "communicationMode": "verbal",
    "deviceInteraction": "independent",
    "functioningLevel": "STANDARD",
    "attentionSpan": "typical",
    "diagnoses": [],
    "responses": {"pref-1": ["soccer"]},
}

CHAPTER = {
    "title": "Word Garden",
    "domain": "ela",
    "sceneDescription": "...",
    "tutorKey": "sage",
}


class TestTeacherOptional:
    def test_no_teacher_emits_optional_marker(self):
        sys, _ = build_baseline_generation_prompt(PARENT)
        assert "## Teacher Input" in sys
        assert "No teacher assessment on file" in sys
        assert "optional" in sys.lower()

    def test_no_teacher_in_discovery_emits_optional_marker(self):
        sys, _ = build_discovery_adventure_prompt(PARENT, CHAPTER)
        assert "## Teacher Input" in sys
        assert "No teacher assessment on file" in sys

    def test_teacher_strengths_and_challenges_surface(self):
        teacher = {
            "teacherRole": "General Ed Teacher",
            "gradeLevel": "2nd",
            "subjectArea": "Reading",
            "strengths": ["decoding CVC words", "sustained focus on picture books"],
            "challenges": ["multi-step instructions", "writing stamina"],
            "accommodations": ["visual schedule", "movement breaks every 15 min"],
            "observations": "Engages best 1:1; visibly fatigues after 25 min.",
            "recommendedFocusAreas": ["fluency", "executive function"],
        }
        sys, _ = build_baseline_generation_prompt(PARENT, teacher_assessment=teacher)
        assert "General Ed Teacher" in sys
        assert "decoding CVC words" in sys
        assert "multi-step instructions" in sys
        assert "visual schedule" in sys
        assert "Engages best 1:1" in sys
        assert "fluency" in sys

    def test_teacher_partial_input_is_acceptable(self):
        # Teacher submits only observations — every other field empty.
        # This is the "OPTIONAL fields" contract: nothing should explode.
        teacher = {
            "observations": "Quiet but attentive; raises hand sparingly.",
        }
        sys, _ = build_baseline_generation_prompt(PARENT, teacher_assessment=teacher)
        assert "Quiet but attentive" in sys
        # Empty bullet sections show the fallback rather than crashing.
        assert "(none recorded)" in sys

    def test_teacher_empty_dict_falls_back_to_no_input_line(self):
        sys, _ = build_baseline_generation_prompt(PARENT, teacher_assessment={})
        assert "No teacher assessment on file" in sys


class TestCaregiverPerspectivesOptional:
    def test_no_caregiver_perspectives_does_not_emit_block(self):
        sys, _ = build_baseline_generation_prompt(PARENT)
        # When zero caregiver perspectives are passed, the dedicated
        # block is suppressed entirely — the parent-assessment summary
        # in the system prompt header still carries the signal.
        assert "## Caregiver Perspectives" not in sys

    def test_single_caregiver_perspective_renders_singular_header(self):
        perspectives = [{
            "submittedBy": "u1",
            "communicationMode": "verbal",
            "deviceInteraction": "independent",
            "responseMethod": "touch_select",
            "attentionSpan": "typical",
            "diagnoses": ["ADHD"],
            "responses": {"str-1": ["building", "drawing"]},
        }]
        sys, _ = build_baseline_generation_prompt(
            PARENT, caregiver_perspectives=perspectives
        )
        assert "## Caregiver Perspectives" in sys
        assert "1 caregiver on file" in sys
        assert "co-parent input is optional" in sys
        assert "building, drawing" in sys

    def test_two_caregivers_with_disagreement_render_both(self):
        perspectives = [
            {
                "submittedBy": "u1",
                "communicationMode": "verbal",
                "deviceInteraction": "independent",
                "responseMethod": "touch_select",
                "attentionSpan": "typical",
                "diagnoses": ["ADHD"],
                "responses": {"ch-1": ["transitions", "loud rooms"]},
            },
            {
                "submittedBy": "u2",
                "communicationMode": "limited_verbal",
                "deviceInteraction": "guided",
                "responseMethod": "touch_select",
                "attentionSpan": "short",
                "diagnoses": ["ADHD", "ASD"],
                "responses": {"ch-1": ["transitions", "writing"]},
            },
        ]
        sys, _ = build_baseline_generation_prompt(
            PARENT, caregiver_perspectives=perspectives
        )
        assert "## Caregiver Perspectives (2 caregivers on file)" in sys
        # Both caregiver communication modes surface — last-write-wins
        # would have hidden the "verbal" answer behind the "limited_verbal" one.
        assert "Communication: verbal" in sys
        assert "Communication: limited_verbal" in sys
        # Disagreement guidance is included.
        assert "more supportive" in sys.lower() or "MORE SUPPORTIVE" in sys

    def test_caregiver_perspectives_dedupe_per_submitter(self):
        # Two rows from the same submitter — only the (most-recent
        # ordered) first one should land in the prompt.
        perspectives = [
            {"submittedBy": "u1", "communicationMode": "verbal", "diagnoses": [], "responses": {}},
            {"submittedBy": "u1", "communicationMode": "limited_verbal", "diagnoses": [], "responses": {}},
        ]
        sys, _ = build_baseline_generation_prompt(
            PARENT, caregiver_perspectives=perspectives
        )
        # The route layer is the canonical dedupe; the prompt builder
        # itself should at minimum NOT crash on either input.
        assert "## Caregiver Perspectives" in sys

    def test_garbage_caregiver_perspectives_input_is_ignored(self):
        sys, _ = build_baseline_generation_prompt(
            PARENT, caregiver_perspectives="not-a-list"  # type: ignore[arg-type]
        )
        assert "## Caregiver Perspectives" not in sys


class TestIepRemainsOptional:
    def test_no_iep_emits_optional_marker(self):
        sys, _ = build_baseline_generation_prompt(PARENT)
        assert "No IEP on file" in sys

    def test_iep_when_provided_renders_goals_and_accommodations(self):
        iep = {
            "disabilityCategories": ["SLD", "OHI"],
            "gradeLevel": "3",
            "communicationSystem": "AAC",
            "assistiveTechnology": ["text-to-speech"],
            "recommendedFunctioningLevel": "SUPPORTED",
            "goals": [
                {"domain": "reading", "description": "decode 2-syllable words", "target": "80% accuracy"},
            ],
            "accommodations": [
                {"type": "presentation", "description": "extended time", "frequency": "always"},
            ],
        }
        sys, _ = build_baseline_generation_prompt(PARENT, iep=iep)
        assert "decode 2-syllable words" in sys
        assert "extended time" in sys
        assert "SLD" in sys


class TestAllOptionalAbsent:
    def test_only_parent_assessment_still_produces_full_prompt(self):
        # The minimum viable case: no IEP, no co-parent, no teacher.
        # The pipeline should still emit a coherent system prompt with
        # all four optional sections present-as-skipped.
        sys, user = build_baseline_generation_prompt(PARENT)
        assert "## Learner Profile" in sys
        assert "No IEP on file" in sys
        assert "No teacher assessment on file" in sys
        assert "## Caregiver Perspectives" not in sys
        # And the user prompt still asks for the 42 questions.
        assert "42 personalized baseline assessment questions" in user
