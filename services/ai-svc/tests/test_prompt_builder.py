"""Tests for the AIVO tutor prompt builder.

Run with: pytest services/ai-svc/tests/test_prompt_builder.py -v
"""
import pytest

from ai_svc.services.prompt_builder import (
    _build_sensory_instructions,
    build_content_generation_prompt,
    build_tutor_system_prompt,
)
from ai_svc.prompts.tutor_personas import TUTOR_PERSONAS


# ---------------------------------------------------------------------------
# Functioning-level adaptations are reflected in the prompt
# ---------------------------------------------------------------------------
class TestFunctioningLevelAdaptations:
    def test_standard_uses_socratic_method(self):
        prompt = build_tutor_system_prompt("ADDON_TUTOR_MATH", {}, "STANDARD")
        assert "Socratic" in prompt or "socratic" in prompt.lower()

    def test_standard_session_length_15_to_20(self):
        prompt = build_tutor_system_prompt("ADDON_TUTOR_MATH", {}, "STANDARD")
        assert "15-20" in prompt

    def test_supported_uses_simpler_language(self):
        prompt = build_tutor_system_prompt("ADDON_TUTOR_MATH", {}, "SUPPORTED")
        assert "Simpler language" in prompt or "simplified" in prompt.lower()

    def test_low_verbal_picture_based(self):
        prompt = build_tutor_system_prompt("ADDON_TUTOR_MATH", {}, "LOW_VERBAL")
        assert "Picture" in prompt or "picture" in prompt
        assert "2-choice" in prompt or "picture_choice" in prompt

    def test_non_verbal_partner_assisted(self):
        prompt = build_tutor_system_prompt("ADDON_TUTOR_MATH", {}, "NON_VERBAL")
        assert "Partner-assisted" in prompt or "partner_assisted" in prompt.lower() or "facilitator" in prompt.lower()

    def test_pre_symbolic_parent_coaching(self):
        prompt = build_tutor_system_prompt("ADDON_TUTOR_MATH", {}, "PRE_SYMBOLIC")
        assert "parent" in prompt.lower() and "coaching" in prompt.lower()

    def test_unknown_functioning_level_falls_back_to_standard(self):
        prompt = build_tutor_system_prompt("ADDON_TUTOR_MATH", {}, "UNKNOWN_LEVEL")
        # Should not crash and should default to STANDARD style
        assert "STANDARD" not in prompt or "Socratic" in prompt or "15-20" in prompt


# ---------------------------------------------------------------------------
# Tutor persona is included
# ---------------------------------------------------------------------------
class TestPersonaIncluded:
    @pytest.mark.parametrize("sku", list(TUTOR_PERSONAS.keys()))
    def test_persona_system_prompt_appears(self, sku):
        prompt = build_tutor_system_prompt(sku, {}, "STANDARD")
        persona = TUTOR_PERSONAS[sku]
        # At least the tutor name should appear
        assert persona["name"] in prompt

    def test_unknown_sku_falls_back_to_default_persona(self):
        prompt = build_tutor_system_prompt("ADDON_TUTOR_NONEXISTENT", {}, "STANDARD")
        assert "helpful AI tutor" in prompt or "tutor" in prompt.lower()


# ---------------------------------------------------------------------------
# Accommodation injection
# ---------------------------------------------------------------------------
class TestAccommodationInjection:
    def test_text_to_speech_appears_in_prompt(self):
        ctx = {"active_accommodations": ["text_to_speech", "extended_time"]}
        prompt = build_tutor_system_prompt("ADDON_TUTOR_MATH", ctx, "STANDARD")
        assert "text_to_speech" in prompt
        assert "extended_time" in prompt

    def test_no_accommodations_section_when_empty(self):
        ctx = {"active_accommodations": []}
        prompt = build_tutor_system_prompt("ADDON_TUTOR_MATH", ctx, "STANDARD")
        assert "Active Accommodations" not in prompt

    def test_picture_supports_appears(self):
        ctx = {"active_accommodations": ["picture_supports", "reduced_text"]}
        prompt = build_tutor_system_prompt("ADDON_TUTOR_MATH", ctx, "LOW_VERBAL")
        assert "picture_supports" in prompt


# ---------------------------------------------------------------------------
# IEP goal injection
# ---------------------------------------------------------------------------
class TestIepGoalInjection:
    def test_iep_goals_appear_in_prompt(self):
        ctx = {
            "iep_profile": {
                "goals": [
                    "Increase reading fluency to 90 wpm",
                    "Solve 2-step word problems with 80% accuracy",
                ]
            }
        }
        prompt = build_tutor_system_prompt("ADDON_TUTOR_ELA", ctx, "STANDARD")
        assert "IEP Goals" in prompt
        assert "reading fluency" in prompt
        assert "2-step word problems" in prompt

    def test_iep_goals_capped_at_5(self):
        goals = [f"Goal #{i}" for i in range(10)]
        ctx = {"iep_profile": {"goals": goals}}
        prompt = build_tutor_system_prompt("ADDON_TUTOR_ELA", ctx, "STANDARD")
        # Only first 5 should appear
        assert "Goal #0" in prompt
        assert "Goal #4" in prompt
        assert "Goal #5" not in prompt

    def test_no_iep_section_when_no_goals(self):
        ctx = {"iep_profile": {}}
        prompt = build_tutor_system_prompt("ADDON_TUTOR_ELA", ctx, "STANDARD")
        assert "IEP Goals" not in prompt


# ---------------------------------------------------------------------------
# Sensory profile injection
# ---------------------------------------------------------------------------
class TestSensoryProfileInjection:
    def test_visual_hyper_includes_muted_colors(self):
        ctx = {"sensory_profile": {"visual": "hyper"}}
        prompt = build_tutor_system_prompt("ADDON_TUTOR_MATH", ctx, "STANDARD")
        assert "muted colors" in prompt
        assert "minimal animations" in prompt

    def test_visual_hypo_increases_stimulation(self):
        ctx = {"sensory_profile": {"visual": "hypo"}}
        prompt = build_tutor_system_prompt("ADDON_TUTOR_MATH", ctx, "STANDARD")
        assert "bright colors" in prompt or "bold text" in prompt

    def test_auditory_hyper_minimizes_audio(self):
        ctx = {"sensory_profile": {"auditory": "hyper"}}
        prompt = build_tutor_system_prompt("ADDON_TUTOR_MATH", ctx, "STANDARD")
        assert "soft tones" in prompt or "text alternatives" in prompt

    def test_tactile_hyper_minimizes_haptic(self):
        ctx = {"sensory_profile": {"tactile": "hyper"}}
        prompt = build_tutor_system_prompt("ADDON_TUTOR_MATH", ctx, "STANDARD")
        assert "haptic" in prompt.lower() or "touch" in prompt.lower()

    def test_typical_sensory_no_adjustments_section(self):
        ctx = {"sensory_profile": {"visual": "typical", "auditory": "typical", "tactile": "typical"}}
        prompt = build_tutor_system_prompt("ADDON_TUTOR_MATH", ctx, "STANDARD")
        assert "Sensory Adjustments" not in prompt


# ---------------------------------------------------------------------------
# Curriculum alignment injection
# ---------------------------------------------------------------------------
class TestCurriculumAlignment:
    def test_ccss_framework_referenced(self):
        ctx = {"curriculum_alignment": {"framework": "CCSS"}}
        prompt = build_tutor_system_prompt("ADDON_TUTOR_MATH", ctx, "STANDARD")
        assert "CCSS" in prompt

    def test_ngss_framework_referenced(self):
        ctx = {"curriculum_alignment": {"framework": "NGSS"}}
        prompt = build_tutor_system_prompt("ADDON_TUTOR_SCIENCE", ctx, "STANDARD")
        assert "NGSS" in prompt

    def test_no_framework_no_section(self):
        ctx = {"curriculum_alignment": {}}
        prompt = build_tutor_system_prompt("ADDON_TUTOR_MATH", ctx, "STANDARD")
        assert "Curriculum Alignment" not in prompt


# ---------------------------------------------------------------------------
# Mastery injection
# ---------------------------------------------------------------------------
class TestMasteryInjection:
    def test_subject_mastery_appears(self):
        # Subject for ADDON_TUTOR_MATH is "Mathematics", filter is substring match
        ctx = {"mastery_levels": {"mathematics_algebra": 0.7, "mathematics_geometry": 0.5}}
        prompt = build_tutor_system_prompt("ADDON_TUTOR_MATH", ctx, "STANDARD")
        assert "Current Mastery" in prompt
        assert "mathematics_algebra" in prompt or "0.7" in prompt

    def test_unrelated_mastery_filtered_out(self):
        ctx = {"mastery_levels": {"history_world_war": 0.9}}
        prompt = build_tutor_system_prompt("ADDON_TUTOR_MATH", ctx, "STANDARD")
        # Math tutor should not display unrelated mastery
        assert "Current Mastery" not in prompt


# ---------------------------------------------------------------------------
# Content generation prompt builder
# ---------------------------------------------------------------------------
class TestContentGenerationPrompt:
    def test_lesson_includes_json_template(self):
        sys_p, user_p = build_content_generation_prompt(
            subject="Math",
            topic="Fractions",
            grade_target="3rd",
            delivery_level="THIRD",
            functioning_level="STANDARD",
            brain_context={},
            content_type="LESSON",
        )
        assert "objective" in user_p
        assert "vocabulary" in user_p

    def test_practice_includes_problems_template(self):
        sys_p, user_p = build_content_generation_prompt(
            subject="Math", topic="Addition", grade_target="K",
            delivery_level="KINDERGARTEN", functioning_level="STANDARD",
            brain_context={}, content_type="PRACTICE",
        )
        assert "problems" in user_p
        assert "difficulty" in user_p

    def test_safety_clause_always_present(self):
        sys_p, _ = build_content_generation_prompt(
            subject="Science", topic="Stars", grade_target="2nd",
            delivery_level="SECOND", functioning_level="STANDARD",
            brain_context={}, content_type="LESSON",
        )
        assert "safe" in sys_p.lower()
        assert "violent" in sys_p.lower() or "inappropriate" in sys_p.lower()

    def test_accommodations_appear_in_user_prompt(self):
        _, user_p = build_content_generation_prompt(
            subject="Math", topic="Numbers", grade_target="K",
            delivery_level="KINDERGARTEN", functioning_level="STANDARD",
            brain_context={"active_accommodations": ["text_to_speech"]},
            content_type="LESSON",
        )
        assert "text_to_speech" in user_p


# ---------------------------------------------------------------------------
# Sensory instructions builder (unit)
# ---------------------------------------------------------------------------
class TestSensoryInstructions:
    def test_empty_profile_returns_empty_string(self):
        assert _build_sensory_instructions({}) == ""

    def test_typical_returns_empty_string(self):
        assert _build_sensory_instructions(
            {"visual": "typical", "auditory": "typical", "tactile": "typical"}
        ) == ""


# ---------------------------------------------------------------------------
# Scaffolding & remediation modifiers (Sprint 4.4)
# ---------------------------------------------------------------------------
class TestScaffoldingAndRemediation:
    def test_first_attempt_has_no_scaffolding(self):
        prompt = build_tutor_system_prompt(
            "ADDON_TUTOR_MATH", {}, "STANDARD",
            attempts_on_current_topic=1, mastery_trend="stable",
        )
        assert "Scaffolding Mode" not in prompt

    def test_two_attempts_still_no_scaffolding(self):
        prompt = build_tutor_system_prompt(
            "ADDON_TUTOR_MATH", {}, "STANDARD",
            attempts_on_current_topic=2, mastery_trend="stable",
        )
        assert "Scaffolding Mode" not in prompt

    def test_three_attempts_triggers_light_scaffolding(self):
        prompt = build_tutor_system_prompt(
            "ADDON_TUTOR_MATH", {}, "STANDARD",
            attempts_on_current_topic=3, mastery_trend="stable",
        )
        assert "Scaffolding Mode (Light)" in prompt
        assert "smaller steps" in prompt
        assert "concrete examples before" in prompt

    def test_four_attempts_still_light_scaffolding(self):
        prompt = build_tutor_system_prompt(
            "ADDON_TUTOR_MATH", {}, "STANDARD",
            attempts_on_current_topic=4, mastery_trend="improving",
        )
        assert "Scaffolding Mode (Light)" in prompt
        assert "Heavy" not in prompt

    def test_five_attempts_triggers_heavy_scaffolding(self):
        prompt = build_tutor_system_prompt(
            "ADDON_TUTOR_MATH", {}, "STANDARD",
            attempts_on_current_topic=5, mastery_trend="stable",
        )
        assert "Scaffolding Mode (Heavy)" in prompt
        assert "prerequisite skills" in prompt
        assert "manipulatives" in prompt or "visual models" in prompt

    def test_seven_attempts_still_heavy(self):
        prompt = build_tutor_system_prompt(
            "ADDON_TUTOR_MATH", {}, "STANDARD",
            attempts_on_current_topic=7, mastery_trend="improving",
        )
        assert "Scaffolding Mode (Heavy)" in prompt

    def test_declining_trend_includes_regression_language(self):
        prompt = build_tutor_system_prompt(
            "ADDON_TUTOR_MATH", {}, "STANDARD",
            attempts_on_current_topic=1, mastery_trend="declining",
        )
        assert "Mastery Trend: Declining" in prompt
        assert "fatigue" in prompt or "prerequisite knowledge" in prompt

    def test_improving_trend_has_no_modifier(self):
        prompt = build_tutor_system_prompt(
            "ADDON_TUTOR_MATH", {}, "STANDARD",
            attempts_on_current_topic=1, mastery_trend="improving",
        )
        assert "Mastery Trend" not in prompt

    def test_stable_at_low_mastery_suggests_new_approach(self):
        prompt = build_tutor_system_prompt(
            "ADDON_TUTOR_MATH", {}, "STANDARD",
            attempts_on_current_topic=2, mastery_trend="stable",
            current_mastery=0.25,
        )
        assert "Stable at Low Level" in prompt
        assert "different modality" in prompt or "different teaching" in prompt.lower()

    def test_stable_at_healthy_mastery_no_modifier(self):
        prompt = build_tutor_system_prompt(
            "ADDON_TUTOR_MATH", {}, "STANDARD",
            attempts_on_current_topic=2, mastery_trend="stable",
            current_mastery=0.75,
        )
        assert "Stable at Low Level" not in prompt

    def test_heavy_scaffolding_combines_with_declining_trend(self):
        prompt = build_tutor_system_prompt(
            "ADDON_TUTOR_MATH", {}, "STANDARD",
            attempts_on_current_topic=6, mastery_trend="declining",
        )
        assert "Scaffolding Mode (Heavy)" in prompt
        assert "Mastery Trend: Declining" in prompt

    def test_default_args_produce_no_scaffolding_section(self):
        # Backwards-compatibility: existing callers that don't pass the new
        # kwargs must not see scaffolding sections appear.
        prompt = build_tutor_system_prompt("ADDON_TUTOR_MATH", {}, "STANDARD")
        assert "Scaffolding Mode" not in prompt
        assert "Mastery Trend" not in prompt


class TestDapeBlock:
    """Vigor's DAPE Track section is only rendered when brain_context contains
    an active dape_profile. The persona narrative covers fitness as the
    default branch when DAPE is inactive."""

    def test_no_dape_block_when_profile_absent(self):
        prompt = build_tutor_system_prompt('ADDON_TUTOR_PE_HEALTH', {}, 'STANDARD')
        assert '## DAPE Track Active' not in prompt

    def test_no_dape_block_when_profile_inactive(self):
        ctx = {'dape_profile': {'active': False, 'categories': [], 'totalMotorGoals': 0}}
        prompt = build_tutor_system_prompt('ADDON_TUTOR_PE_HEALTH', ctx, 'STANDARD')
        assert '## DAPE Track Active' not in prompt

    def test_dape_block_renders_when_active(self):
        ctx = {
            'dape_profile': {
                'active': True,
                'source': 'service+goal',
                'totalMotorGoals': 3,
                'categories': [
                    {'id': 'locomotor', 'label': 'Locomotor skills',
                     'goalCount': 2, 'sampleGoal': 'Skip across the gym'},
                    {'id': 'midline_crossing', 'label': 'Midline crossing',
                     'goalCount': 1, 'sampleGoal': 'Cross-crawl 20 times'},
                ],
            }
        }
        prompt = build_tutor_system_prompt('ADDON_TUTOR_PE_HEALTH', ctx, 'STANDARD')
        assert '## DAPE Track Active' in prompt
        assert 'both an active DAPE service line and motor IEP goals' in prompt
        assert 'Motor goals on file: 3' in prompt
        assert 'Locomotor skills (2 goals)' in prompt
        assert 'Skip across the gym' in prompt
        assert 'Midline crossing (1 goal)' in prompt
        # Reminds Vigor to keep tracking motor progress separately so the
        # parent / therapist Motor Progress report stays accurate.
        assert 'regulation break' in prompt.lower()

    def test_dape_block_truncates_long_sample_goals(self):
        long_goal = 'A' * 200
        ctx = {
            'dape_profile': {
                'active': True,
                'source': 'goal',
                'totalMotorGoals': 1,
                'categories': [
                    {'id': 'locomotor', 'label': 'Locomotor skills',
                     'goalCount': 1, 'sampleGoal': long_goal},
                ],
            }
        }
        prompt = build_tutor_system_prompt('ADDON_TUTOR_PE_HEALTH', ctx, 'STANDARD')
        assert long_goal not in prompt
        assert 'A' * 120 + '…' in prompt

    def test_dape_block_caps_at_four_categories(self):
        cats = [
            {'id': i, 'label': f'Cat {i}', 'goalCount': 5 - n}
            for n, i in enumerate(['locomotor', 'object_control', 'balance',
                                   'midline_crossing', 'fine_motor'])
        ]
        ctx = {'dape_profile': {'active': True, 'source': 'goal',
                                'totalMotorGoals': 5, 'categories': cats}}
        prompt = build_tutor_system_prompt('ADDON_TUTOR_PE_HEALTH', ctx, 'STANDARD')
        assert 'Cat locomotor' in prompt
        assert 'Cat midline_crossing' in prompt
        # Fifth category (fine_motor) must not appear.
        assert 'Cat fine_motor' not in prompt

    def test_dape_block_handles_unknown_source(self):
        ctx = {'dape_profile': {'active': True, 'source': 'mystery',
                                'totalMotorGoals': 1,
                                'categories': [{'id': 'balance', 'label': 'Balance',
                                                'goalCount': 1}]}}
        prompt = build_tutor_system_prompt('ADDON_TUTOR_PE_HEALTH', ctx, 'STANDARD')
        assert '## DAPE Track Active' in prompt
        assert 'active DAPE indicators on the IEP' in prompt


# ---------------------------------------------------------------------------
# Response-language directive: the prompt must instruct the tutor to
# respond in the learner's selected UI locale.
# ---------------------------------------------------------------------------
class TestLanguageDirective:
    def test_default_locale_renders_english_directive(self):
        prompt = build_tutor_system_prompt("ADDON_TUTOR_MATH", {}, "STANDARD")
        assert "## Response Language" in prompt
        assert "English" in prompt

    def test_explicit_english_locale_matches_default(self):
        prompt = build_tutor_system_prompt(
            "ADDON_TUTOR_MATH", {}, "STANDARD", locale="en"
        )
        assert "## Response Language" in prompt
        assert "Respond entirely in English" in prompt

    def test_spanish_locale_renders_spanish_directive(self):
        prompt = build_tutor_system_prompt(
            "ADDON_TUTOR_MATH", {}, "STANDARD", locale="es"
        )
        assert "Spanish" in prompt
        assert "Respond entirely in Spanish" in prompt
        # Non-English locales should also encourage subject-vocabulary glossing
        assert "Translate or gloss subject-specific vocabulary" in prompt

    def test_french_locale_renders_french_directive(self):
        prompt = build_tutor_system_prompt(
            "ADDON_TUTOR_MATH", {}, "STANDARD", locale="fr"
        )
        assert "Respond entirely in French" in prompt

    def test_full_bcp47_tag_is_normalised_to_base(self):
        prompt = build_tutor_system_prompt(
            "ADDON_TUTOR_MATH", {}, "STANDARD", locale="es-MX"
        )
        assert "Respond entirely in Spanish" in prompt

    def test_unknown_locale_falls_back_to_english(self):
        prompt = build_tutor_system_prompt(
            "ADDON_TUTOR_MATH", {}, "STANDARD", locale="xx"
        )
        assert "Respond entirely in English" in prompt

    def test_none_locale_falls_back_to_english(self):
        prompt = build_tutor_system_prompt(
            "ADDON_TUTOR_MATH", {}, "STANDARD", locale=None
        )
        assert "Respond entirely in English" in prompt

    def test_empty_string_locale_falls_back_to_english(self):
        prompt = build_tutor_system_prompt(
            "ADDON_TUTOR_MATH", {}, "STANDARD", locale=""
        )
        assert "Respond entirely in English" in prompt

    def test_directive_appears_after_persona_block(self):
        # Putting the language directive last maximises adherence — we
        # explicitly want the directive at the end of the prompt.
        prompt = build_tutor_system_prompt(
            "ADDON_TUTOR_MATH", {}, "STANDARD", locale="ja"
        )
        idx_persona = prompt.find("Subject Strategy")
        idx_lang = prompt.find("Response Language")
        assert idx_persona >= 0 and idx_lang > idx_persona

    def test_locale_works_for_every_supported_language(self):
        # All UI-supported locales must round-trip a coherent directive.
        cases = {
            "en": "English",
            "es": "Spanish",
            "fr": "French",
            "de": "German",
            "pt": "Portuguese",
            "zh": "Chinese (Simplified)",
            "ja": "Japanese",
            "ko": "Korean",
            "ar": "Arabic",
            "hi": "Hindi",
        }
        for code, name in cases.items():
            prompt = build_tutor_system_prompt(
                "ADDON_TUTOR_MATH", {}, "STANDARD", locale=code
            )
            assert f"Respond entirely in {name}" in prompt, f"locale={code}"


class TestLinguaLanguageProfile:
    """Lingua expects a `language_profile` to drive bilingual scaffolding.
    When the caller hasn't supplied one but a non-English locale is set,
    the prompt builder should surface the locale as the learner's
    dominant_language so the persona's protocol can engage."""

    def test_lingua_synthesises_dominant_language_from_locale(self):
        prompt = build_tutor_system_prompt(
            "ADDON_TUTOR_LANGUAGES", {}, "STANDARD", locale="es"
        )
        assert "## Language Profile" in prompt
        assert "Dominant language: Spanish" in prompt

    def test_lingua_respects_explicit_language_profile(self):
        ctx = {
            "language_profile": {
                "dominant_language": "Spanish",
                "target_language": "French",
            }
        }
        prompt = build_tutor_system_prompt(
            "ADDON_TUTOR_LANGUAGES", ctx, "STANDARD", locale="es"
        )
        assert "Dominant language: Spanish" in prompt
        assert "Target language: French" in prompt

    def test_other_tutors_dont_synthesise_language_profile(self):
        # Only Lingua needs a synthetic language_profile; other tutors
        # carry the language directive without an extra block.
        prompt = build_tutor_system_prompt(
            "ADDON_TUTOR_MATH", {}, "STANDARD", locale="es"
        )
        assert "## Language Profile" not in prompt

