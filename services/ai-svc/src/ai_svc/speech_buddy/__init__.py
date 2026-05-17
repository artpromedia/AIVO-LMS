"""Speech Buddy agent core.

Public surface — stable for tutor-svc, engagement-svc and the upcoming
UI/skill-graph tasks. The interface-only Protocols (``SpeechBuddyOrchestrator``,
``SpeechBuddyToolset``) stay for type checking; the concrete defaults live
in ``orchestrator_impl`` and ``tools_impl``.

See:
    docs/products/speech-buddy/README.md       (session format, SEL skill map)
    docs/products/speech-buddy/safety.md       (safety policy)
    docs/products/speech-buddy/threat-model.md
    docs/products/speech-buddy/agent-core.md   (this task: latency, fallback plan, SME checklist)
"""

from .types import (
    AGE_BANDS,
    SAFETY_FLAG_CATEGORIES,
    SKILL_TAGS,
    AgeBand,
    SafetyFlag,
    SafetyFlagCategory,
    SafetyFlagSeverity,
    SkillTag,
    SpeechBuddySession,
    SpeechBuddyState,
    TurnEvent,
)
from .orchestrator import (
    SPEECH_BUDDY_STATES,
    SpeechBuddyOrchestrator,
)
from .tools import SpeechBuddyToolset
from .safety import (
    CRISIS_SCRIPT_EN,
    CRISIS_SCRIPT_ES,
    HARD_CATEGORIES,
    SafetyDecision,
    SafetyFilter,
    routed_response,
)
from .stt import MockSTT, STTAdapter, STTResult, WhisperSTT, get_default_stt
from .tts import (
    DEFAULT_WPM,
    MockTTS,
    SLOW_TALK_WPM,
    TTSAdapter,
    TTSResult,
    VOICE_PRESETS,
    get_default_tts,
)
from .vad import BargeInDetector, EndOfUtteranceDetector, VadFrame
from .tools_impl import DefaultToolset
from .events import EventEmitter, hash_learner_id
from .encryption import (
    EncryptedTranscript,
    decrypt_transcript,
    derive_tenant_key,
    encrypt_transcript,
)
from .orchestrator_impl import DefaultOrchestrator, TurnOutcome, TurnTrace
from .red_team_prompts import RED_TEAM_PROMPTS

__all__ = [
    "AGE_BANDS",
    "BargeInDetector",
    "CRISIS_SCRIPT_EN",
    "CRISIS_SCRIPT_ES",
    "DEFAULT_WPM",
    "DefaultOrchestrator",
    "DefaultToolset",
    "EncryptedTranscript",
    "EndOfUtteranceDetector",
    "EventEmitter",
    "HARD_CATEGORIES",
    "MockSTT",
    "MockTTS",
    "RED_TEAM_PROMPTS",
    "SAFETY_FLAG_CATEGORIES",
    "SKILL_TAGS",
    "SLOW_TALK_WPM",
    "SPEECH_BUDDY_STATES",
    "STTAdapter",
    "STTResult",
    "SafetyDecision",
    "SafetyFilter",
    "SafetyFlag",
    "SafetyFlagCategory",
    "SafetyFlagSeverity",
    "SkillTag",
    "AgeBand",
    "SpeechBuddyOrchestrator",
    "SpeechBuddySession",
    "SpeechBuddyState",
    "SpeechBuddyToolset",
    "TTSAdapter",
    "TTSResult",
    "TurnEvent",
    "TurnOutcome",
    "TurnTrace",
    "VOICE_PRESETS",
    "VadFrame",
    "WhisperSTT",
    "decrypt_transcript",
    "derive_tenant_key",
    "encrypt_transcript",
    "get_default_stt",
    "get_default_tts",
    "hash_learner_id",
    "routed_response",
]
