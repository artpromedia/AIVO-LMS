"""
FastAPI observability middleware — vendored copy (kept in sync with brain-svc's
copy and packages/observability/src/fastapi-middleware.py).

Usage:
    from mastery_svc._observability import add_observability
    add_observability(app, service_name="mastery-svc")
"""
from __future__ import annotations

import json
import logging
import time
import uuid
from collections import defaultdict
from typing import Callable

from fastapi import FastAPI, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

SENSITIVE_KEY_RE_PARTS = ["token", "key", "secret", "password", "credential", "auth"]


def _sanitize(data: object, depth: int = 0) -> object:
    if depth > 10 or not isinstance(data, (dict, list)):
        return data
    if isinstance(data, list):
        return [_sanitize(v, depth + 1) for v in data]
    return {
        k: "[REDACTED]" if any(p in k.lower() for p in SENSITIVE_KEY_RE_PARTS) else _sanitize(v, depth + 1)
        for k, v in data.items()
    }


class JsonFormatter(logging.Formatter):
    def __init__(self, service: str) -> None:
        super().__init__()
        self.service = service

    def format(self, record: logging.LogRecord) -> str:
        payload: dict = {
            "level": record.levelname.lower(),
            "service": self.service,
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S.%fZ"),
            "message": record.getMessage(),
        }
        if isinstance(record.args, dict):
            payload.update(_sanitize(record.args))  # type: ignore[arg-type]
        return json.dumps(payload)


def create_json_logger(service: str) -> logging.Logger:
    logger = logging.getLogger(service)
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(JsonFormatter(service))
        logger.addHandler(handler)
    logger.setLevel(logging.DEBUG)
    return logger


_counters: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
_histograms: dict[str, list[float]] = defaultdict(list)


def inc_counter(name: str, labels: dict[str, str] | None = None, value: float = 1.0) -> None:
    key = json.dumps(labels or {}, sort_keys=True)
    _counters[name][key] += value


def record_histogram(name: str, value: float, labels: dict[str, str] | None = None) -> None:
    key = json.dumps(labels or {}, sort_keys=True)
    _histograms[f"{name}|{key}"].append(value)


def export_metrics() -> str:
    lines: list[str] = []
    for name, label_map in _counters.items():
        lines.append(f"# TYPE {name} counter")
        for lj, val in label_map.items():
            lv = json.loads(lj)
            ls = ",".join(f'{k}="{v}"' for k, v in lv.items())
            lines.append(f"{name}{{{ls}}} {val}" if ls else f"{name} {val}")
    return "\n".join(lines)


class ObservabilityMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp, service: str) -> None:
        super().__init__(app)
        self.logger = create_json_logger(service)
        self.service = service

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        start = time.monotonic()
        response = await call_next(request)
        duration_ms = round((time.monotonic() - start) * 1000, 2)
        self.logger.info(
            "http_request",
            {
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
                "request_id": request_id,
            },
        )
        inc_counter("http_requests_total", {"method": request.method, "path": request.url.path, "status": str(response.status_code)})
        record_histogram("http_request_duration_seconds", duration_ms / 1000, {"method": request.method, "path": request.url.path})
        response.headers["x-request-id"] = request_id
        return response


def add_observability(app: FastAPI, service_name: str) -> None:
    app.add_middleware(ObservabilityMiddleware, service=service_name)

    @app.get("/metrics", include_in_schema=False)
    async def metrics_endpoint() -> Response:
        return Response(content=export_metrics(), media_type="text/plain; version=0.0.4")
