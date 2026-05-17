"""Vision AI homework OCR processor.

Orchestrates image → text/equation extraction using Gemini Vision primary
and GPT-4o fallback via LiteLLM.
"""

from __future__ import annotations

import base64
import json
import logging
from dataclasses import dataclass, field
from typing import Any

from ..services.llm_gateway import generate_completion, VISION_MODEL_PRIORITY
from .subject_detector import detect_subject, DetectedSubject

logger = logging.getLogger(__name__)

_OCR_SYSTEM_PROMPT = """You are a homework OCR and analysis expert. Extract ALL content from the homework image.

Return a JSON object with:
{
  "printed_text": "all printed text found",
  "handwritten_text": "all handwritten text found",
  "math_equations": ["LaTeX format equations found"],
  "tables": [{"headers": [...], "rows": [[...]]}],
  "diagrams": ["description of each diagram"],
  "problems": [
    {
      "number": 1,
      "text": "full problem text",
      "type": "MCQ|SHORT_ANSWER|EQUATION|WORD_PROBLEM",
      "choices": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "equations_latex": ["any LaTeX equations in this problem"],
      "student_answer": "what the student wrote (if visible, else null)"
    }
  ]
}

Rules:
- For math: convert ALL expressions to LaTeX in the equations_latex array
- For MCQ: extract all answer choices into the choices array
- For word problems: include the complete text with no truncation
- Identify problem boundaries carefully (numbered, lettered, visual separators)
- If text is partially illegible, include what you can read and mark unclear parts with [illegible]

Return ONLY the JSON object, no markdown fences."""


@dataclass
class ExtractedProblem:
    number: int
    problem_text: str
    problem_type: str
    extracted_choices: list[str] = field(default_factory=list)
    detected_equations_latex: list[str] = field(default_factory=list)
    student_answer: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "number": self.number,
            "problem_text": self.problem_text,
            "problem_type": self.problem_type,
            "extracted_choices": self.extracted_choices,
            "detected_equations_latex": self.detected_equations_latex,
            "student_answer": self.student_answer,
        }


@dataclass
class ExtractedDocument:
    raw_text: str = ""
    handwritten_text: str = ""
    math_equations: list[str] = field(default_factory=list)
    tables: list[dict[str, Any]] = field(default_factory=list)
    diagrams: list[str] = field(default_factory=list)
    detected_subject: DetectedSubject | None = None
    problems: list[ExtractedProblem] = field(default_factory=list)
    model: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "raw_text": self.raw_text,
            "handwritten_text": self.handwritten_text,
            "math_equations": self.math_equations,
            "tables": self.tables,
            "diagrams": self.diagrams,
            "detected_subject": self.detected_subject.to_dict() if self.detected_subject else None,
            "problems": [p.to_dict() for p in self.problems],
            "model": self.model,
        }


async def process_ocr(
    image_base64: str | None = None,
    text_input: str | None = None,
    mime_type: str = "image/jpeg",
) -> ExtractedDocument:
    """Extract structured content from a homework image or pasted text.

    For images: sends to vision-capable LLM for OCR extraction.
    For pasted text: parses directly and detects subject.
    """
    if text_input and not image_base64:
        return await _process_text_input(text_input)

    if not image_base64:
        return ExtractedDocument(raw_text="No input provided")

    if mime_type == "application/pdf":
        return await _process_pdf(image_base64)

    user_content = [
        {
            "type": "image_url",
            "image_url": {
                "url": f"data:{mime_type};base64,{image_base64}",
            },
        },
        {
            "type": "text",
            "text": "Extract all content from this homework image. Return the JSON structure as specified.",
        },
    ]

    try:
        result = await generate_completion(
            system_prompt=_OCR_SYSTEM_PROMPT,
            user_prompt=user_content,
            max_tokens=3000,
            temperature=0.2,
            model_chain=VISION_MODEL_PRIORITY,
        )

        doc = _parse_vision_response(result["content"])
        doc.model = result.get("model", "")

        combined = _build_combined_text(doc)
        doc.detected_subject = await detect_subject(combined)

        return doc

    except Exception as e:
        logger.error(f"OCR processing failed: {e}")
        return ExtractedDocument(raw_text=f"OCR processing failed: {str(e)}")


async def _process_pdf(pdf_base64: str) -> ExtractedDocument:
    """Extract text from a PDF and process as text input.

    Uses pypdf for text extraction. If text extraction yields
    content, processes as text. Otherwise falls back to sending
    individual pages as images to vision model.
    """
    try:
        import io
        pdf_bytes = base64.b64decode(pdf_base64)

        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(pdf_bytes))
            pages_text = []
            for page in reader.pages[:10]:
                text = page.extract_text()
                if text and text.strip():
                    pages_text.append(text.strip())

            if pages_text:
                combined_text = "\n\n".join(pages_text)
                return await _process_text_input(combined_text)
        except ImportError:
            logger.warning("pypdf not available, falling back to LLM text extraction")

        result = await generate_completion(
            system_prompt=_OCR_SYSTEM_PROMPT,
            user_prompt=[
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:application/pdf;base64,{pdf_base64}",
                    },
                },
                {
                    "type": "text",
                    "text": "Extract all content from this PDF homework document. Return the JSON structure as specified.",
                },
            ],
            max_tokens=3000,
            temperature=0.2,
            model_chain=VISION_MODEL_PRIORITY,
        )

        doc = _parse_vision_response(result["content"])
        doc.model = result.get("model", "")
        combined = _build_combined_text(doc)
        doc.detected_subject = await detect_subject(combined)
        return doc

    except Exception as e:
        logger.error(f"PDF processing failed: {e}")
        return ExtractedDocument(raw_text=f"PDF processing failed: {str(e)}")


async def _process_text_input(text: str) -> ExtractedDocument:
    """Process pasted text homework content."""
    doc = ExtractedDocument(raw_text=text)
    doc.detected_subject = await detect_subject(text)
    doc.problems = _extract_problems_from_text(text)
    return doc


def _extract_problems_from_text(text: str) -> list[ExtractedProblem]:
    """Simple problem extraction from pasted text."""
    import re
    problems = []
    lines = text.strip().split("\n")
    current_problem = ""
    current_number = 0

    for line in lines:
        match = re.match(r"^(\d+)[.)]\s*(.*)", line.strip())
        if match:
            if current_problem and current_number > 0:
                problems.append(ExtractedProblem(
                    number=current_number,
                    problem_text=current_problem.strip(),
                    problem_type="SHORT_ANSWER",
                ))
            current_number = int(match.group(1))
            current_problem = match.group(2)
        else:
            current_problem += " " + line.strip()

    if current_problem and current_number > 0:
        problems.append(ExtractedProblem(
            number=current_number,
            problem_text=current_problem.strip(),
            problem_type="SHORT_ANSWER",
        ))

    if not problems and text.strip():
        problems.append(ExtractedProblem(
            number=1,
            problem_text=text.strip(),
            problem_type="SHORT_ANSWER",
        ))

    return problems


def _parse_vision_response(response_text: str) -> ExtractedDocument:
    try:
        clean = response_text.strip()
        if clean.startswith("```"):
            lines = clean.split("\n")
            clean = "\n".join(lines[1:-1]) if len(lines) > 2 else clean
        if clean.endswith("```"):
            clean = clean[:-3]
        data = json.loads(clean)
    except json.JSONDecodeError:
        logger.warning("Failed to parse OCR extraction JSON, using raw text")
        return ExtractedDocument(raw_text=response_text)

    problems: list[ExtractedProblem] = []
    for p in data.get("problems", []):
        problems.append(ExtractedProblem(
            number=p.get("number", len(problems) + 1),
            problem_text=p.get("text", ""),
            problem_type=p.get("type", "SHORT_ANSWER"),
            extracted_choices=p.get("choices", []),
            detected_equations_latex=p.get("equations_latex", []),
            student_answer=p.get("student_answer"),
        ))

    return ExtractedDocument(
        raw_text=data.get("printed_text", ""),
        handwritten_text=data.get("handwritten_text", ""),
        math_equations=data.get("math_equations", []),
        tables=data.get("tables", []),
        diagrams=data.get("diagrams", []),
        problems=problems,
    )


def _build_combined_text(doc: ExtractedDocument) -> str:
    parts = [doc.raw_text, doc.handwritten_text]
    for p in doc.problems:
        parts.append(p.problem_text)
    for eq in doc.math_equations:
        parts.append(eq)
    return "\n".join(p for p in parts if p)
