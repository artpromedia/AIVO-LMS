"""Per-stage tracing spans for the Speech Buddy turn pipeline.

We emit one structured log line per stage (``speech_buddy.span``) tagged
with the correlation id so a log-based OTel exporter / Loki+Tempo
pipeline can reconstruct a per-turn waterfall in production. When the
optional ``opentelemetry`` SDK is importable we additionally start a
real OTel span; absent the SDK we still get the structured log + the
timing field that gets surfaced in the ``TurnTrace`` returned by
``run_turn``.

The orchestrator wraps STT, safety_in, planner, safety_out, TTS, and
end-of-session with ``trace_span(name, correlation_id)`` and reads
``span.duration_ms`` to populate the per-stage millisecond fields on
the response.
"""
from __future__ import annotations

import logging
import time
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Iterator, Optional

logger = logging.getLogger("ai-svc.speech_buddy.tracing")

try:  # pragma: no cover - optional otel sdk
    from opentelemetry import trace as _otel_trace  # type: ignore
    _tracer = _otel_trace.get_tracer("speech-buddy")
    _HAS_OTEL = True
except Exception:  # pragma: no cover
    _tracer = None
    _HAS_OTEL = False


@dataclass
class Span:
    name: str
    correlation_id: str
    duration_ms: float = 0.0
    error: Optional[str] = None


@contextmanager
def trace_span(name: str, correlation_id: str, **attrs: object) -> Iterator[Span]:
    """Context manager that times ``name`` and emits a structured log span.

    On exit the span carries ``duration_ms`` so callers can populate the
    per-stage fields of ``TurnTrace`` without re-measuring time."""
    span = Span(name=name, correlation_id=correlation_id)
    start = time.perf_counter()
    otel_span = _tracer.start_span(f"speech_buddy.{name}") if _HAS_OTEL and _tracer else None
    if otel_span is not None:  # pragma: no cover
        otel_span.set_attribute("correlation_id", correlation_id)
        for k, v in attrs.items():
            try:
                otel_span.set_attribute(k, v)  # type: ignore[arg-type]
            except Exception:
                pass
    try:
        yield span
    except Exception as exc:
        span.error = type(exc).__name__
        if otel_span is not None:  # pragma: no cover
            otel_span.record_exception(exc)
        raise
    finally:
        span.duration_ms = (time.perf_counter() - start) * 1000.0
        logger.info(
            "speech_buddy.span",
            extra={
                "span_name": name,
                "correlation_id": correlation_id,
                "duration_ms": round(span.duration_ms, 3),
                "error": span.error,
                **{f"attr.{k}": v for k, v in attrs.items()},
            },
        )
        if otel_span is not None:  # pragma: no cover
            otel_span.end()


__all__ = ["Span", "trace_span"]
