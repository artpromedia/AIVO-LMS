/**
 * Homework OCR provider interface and a deterministic text fallback.
 *
 * Image OCR providers register against the interface. The default behavior
 * accepts plain text uploads and splits them into "detected problems" using
 * blank-line / numbered-prompt heuristics. Image inputs without a provider
 * return a safe empty result rather than throwing.
 */

export interface OcrExtractInput {
  fileUrl?: string;
  base64?: string;
  mimeType: string;
  learnerId: string;
  text?: string;
}

export interface DetectedProblem {
  id: string;
  subject?: string;
  prompt: string;
  visualElements?: string[];
}

export interface OcrExtractResult {
  text: string;
  confidence: number;
  detectedProblems: DetectedProblem[];
}

export interface HomeworkOcrProvider {
  extract(input: OcrExtractInput): Promise<OcrExtractResult>;
}

function splitIntoProblems(text: string): DetectedProblem[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const blocks = trimmed.split(/\n\s*\n+/);
  if (blocks.length > 1) {
    return blocks.map((block, index) => ({
      id: `prob-${index + 1}`,
      prompt: block.trim(),
    }));
  }
  // Try numbered prompt heuristic ("1.", "2)", "Problem 3:")
  const numbered = trimmed.split(/(?:^|\n)\s*(?:\d+[\.\)]|problem\s+\d+:?)\s*/i);
  const filtered = numbered.map((s) => s.trim()).filter((s) => s.length > 0);
  if (filtered.length > 1) {
    return filtered.map((block, index) => ({
      id: `prob-${index + 1}`,
      prompt: block,
    }));
  }
  return [{ id: "prob-1", prompt: trimmed }];
}

export class TextOnlyHomeworkOcrProvider implements HomeworkOcrProvider {
  async extract(input: OcrExtractInput): Promise<OcrExtractResult> {
    if (input.text && input.text.trim().length > 0) {
      return {
        text: input.text,
        confidence: 1,
        detectedProblems: splitIntoProblems(input.text),
      };
    }
    // No image OCR engine registered — return a safe empty result.
    return {
      text: "",
      confidence: 0,
      detectedProblems: [],
    };
  }
}

export const defaultHomeworkOcrProvider = new TextOnlyHomeworkOcrProvider();
