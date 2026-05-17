"""Advanced content generators for math, science, ELA, and world language.

These generators build StagePlan-shaped activity scaffolds that include the
required `subjectBrainEvidenceUsed` field, learner surfaces, scaffolds, and
profile adaptations. They depend only on plain Python so they can be unit
tested without invoking an LLM. The live LLM path consumes the same output
shape as additional prompt context.
"""

from .math_generator import generate_math_activity
from .science_generator import generate_science_activity
from .ela_generator import generate_ela_activity
from .world_language_generator import generate_world_language_activity

__all__ = [
    "generate_math_activity",
    "generate_science_activity",
    "generate_ela_activity",
    "generate_world_language_activity",
]
