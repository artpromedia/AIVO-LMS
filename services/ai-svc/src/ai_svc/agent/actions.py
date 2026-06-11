"""Wave E (S7) — the closed tutor-agent action set + reply protocol.

The model must reply with EXACTLY one JSON object:

    {"action": {"kind": "...", ...}, "rationale": "..."}
or  {"tool_calls": [{"name": "...", "arguments": {...}}], "rationale": "..."}

Everything here is strict pydantic: unknown kinds, missing fields, extra
keys, oversized text, and unknown tool names are validation errors the
loop feeds back for one retry before falling back. The action set is the
SessionMachine's legal-move vocabulary (Wave E S8) — adding a kind here
without a stage-runtime transition rule would let the agent propose
moves the runtime must reject, so the two lists are kept in lockstep.
"""
from __future__ import annotations

import json
import re
from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field, ValidationError

MAX_SAY_CHARS = 600
MAX_FIELD_CHARS = 300


class _StrictModel(BaseModel):
    model_config = {"extra": "forbid"}


class AdvanceAction(_StrictModel):
    kind: Literal["advance"]
    encouragement: str | None = Field(default=None, max_length=MAX_FIELD_CHARS)


class RemediateAction(_StrictModel):
    kind: Literal["remediate"]
    """Re-teach the current skill before moving on."""
    focus: str = Field(min_length=3, max_length=MAX_FIELD_CHARS)
    approach: Literal["worked_example", "simpler_item", "manipulative", "re_explain"] = (
        "re_explain"
    )


class SwitchModalityAction(_StrictModel):
    kind: Literal["switch_modality"]
    modality: Literal["visual", "auditory", "kinesthetic", "reading"]


class InsertScaffoldAction(_StrictModel):
    kind: Literal["insert_scaffold"]
    scaffold: str = Field(min_length=3, max_length=MAX_FIELD_CHARS)


class OfferBreakAction(_StrictModel):
    kind: Literal["offer_break"]
    reason: Literal["frustration", "fatigue", "pacing", "learner_request"] = "pacing"
    duration_seconds: int = Field(default=60, ge=15, le=600)


class EndEarlyAction(_StrictModel):
    kind: Literal["end_early"]
    reason: str = Field(min_length=3, max_length=MAX_FIELD_CHARS)


class PresentSurfaceAction(_StrictModel):
    kind: Literal["present_surface"]
    surface_type: str = Field(min_length=2, max_length=64)
    spec: dict = Field(default_factory=dict)


class SayAction(_StrictModel):
    kind: Literal["say"]
    text: str = Field(min_length=1, max_length=MAX_SAY_CHARS)


AgentAction = Annotated[
    Union[
        AdvanceAction,
        RemediateAction,
        SwitchModalityAction,
        InsertScaffoldAction,
        OfferBreakAction,
        EndEarlyAction,
        PresentSurfaceAction,
        SayAction,
    ],
    Field(discriminator="kind"),
]

ACTION_KINDS: tuple[str, ...] = (
    "advance",
    "remediate",
    "switch_modality",
    "insert_scaffold",
    "offer_break",
    "end_early",
    "present_surface",
    "say",
)


class ToolCall(_StrictModel):
    name: str = Field(min_length=1, max_length=64)
    arguments: dict = Field(default_factory=dict)


class _ActionReply(_StrictModel):
    action: AgentAction
    rationale: str = Field(default="", max_length=500)


class _ToolReply(_StrictModel):
    tool_calls: list[ToolCall] = Field(min_length=1, max_length=3)
    rationale: str = Field(default="", max_length=500)


class ParsedReply(BaseModel):
    """Validated model output — exactly one of action / tool_calls."""

    action: AgentAction | None = None
    tool_calls: list[ToolCall] | None = None
    rationale: str = ""


class ReplyValidationError(ValueError):
    """Model output failed the protocol. `detail` is fed back on retry."""

    def __init__(self, detail: str):
        super().__init__(detail)
        self.detail = detail


_FENCE_RE = re.compile(r"```(?:json)?\s*([\s\S]*?)```")


def _extract_json_object(text: str) -> str:
    candidate = text.strip()
    fenced = _FENCE_RE.search(candidate)
    if fenced:
        candidate = fenced.group(1).strip()
    start = candidate.find("{")
    end = candidate.rfind("}")
    if start < 0 or end <= start:
        raise ReplyValidationError("reply must be a single JSON object")
    return candidate[start : end + 1]


def parse_agent_reply(
    raw: str,
    *,
    allowed_actions: list[str],
    allowed_tools: list[str],
) -> ParsedReply:
    """Strictly parse + validate one model reply. Raises
    :class:`ReplyValidationError` with an actionable detail message."""
    try:
        payload = json.loads(_extract_json_object(raw))
    except json.JSONDecodeError as exc:
        raise ReplyValidationError(f"invalid JSON: {exc.msg}") from exc
    if not isinstance(payload, dict):
        raise ReplyValidationError("reply must be a JSON object")

    has_action = "action" in payload
    has_tools = "tool_calls" in payload
    if has_action == has_tools:
        raise ReplyValidationError(
            'reply must contain exactly one of "action" or "tool_calls"'
        )

    if has_tools:
        try:
            parsed = _ToolReply.model_validate(payload)
        except ValidationError as exc:
            raise ReplyValidationError(f"tool_calls failed validation: {exc}") from exc
        unknown = [c.name for c in parsed.tool_calls if c.name not in allowed_tools]
        if unknown:
            raise ReplyValidationError(
                f"unknown tool(s) {unknown}; allowed: {sorted(allowed_tools)}"
            )
        return ParsedReply(tool_calls=parsed.tool_calls, rationale=parsed.rationale)

    try:
        parsed_action = _ActionReply.model_validate(payload)
    except ValidationError as exc:
        raise ReplyValidationError(f"action failed validation: {exc}") from exc
    if parsed_action.action.kind not in allowed_actions:
        raise ReplyValidationError(
            f'action kind "{parsed_action.action.kind}" is not allowed here; '
            f"allowed: {sorted(allowed_actions)}"
        )
    return ParsedReply(action=parsed_action.action, rationale=parsed_action.rationale)


def learner_visible_text(action: AgentAction) -> list[str]:
    """Text fields the learner will see — every one must pass the quality
    gate before the action leaves ai-svc."""
    out: list[str] = []
    if action.kind == "say":
        out.append(action.text)
    elif action.kind == "advance" and action.encouragement:
        out.append(action.encouragement)
    elif action.kind == "insert_scaffold":
        out.append(action.scaffold)
    elif action.kind == "remediate":
        out.append(action.focus)
    return out
