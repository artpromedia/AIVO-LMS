/**
 * Deterministic rule-based math expression parser. Recognizes a small but
 * useful set of patterns:
 *   - explicit multiplication "l * w", "length * width"
 *   - "length x width" patterns ("8 x 4")
 *   - repeated addition "8 + 8 + 8 + 8"
 *   - unit on a final answer ("32 cm^2", "32 square cm")
 *   - perimeter formulas (2*(l+w))
 *
 * This is *not* a general algebra parser. It exists so the recognizer can
 * react to common misconceptions in elementary math without needing an ML
 * provider for the cold-start path. ML providers can replace it later via
 * `MathRecognizerProvider`.
 */

export interface ParsedExpression {
  raw: string;
  normalized: string;
  numbers: number[];
  operators: string[];
  hasUnit: boolean;
  detectedUnit?: string;
  detectedFormula?: "area_rectangle" | "perimeter_rectangle" | "repeated_addition";
}

const UNIT_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(cm\s*\^?2|square\s*cm|sq\.?\s*cm)\b/i, label: "cm^2" },
  { pattern: /\b(m\s*\^?2|square\s*m|sq\.?\s*m)\b/i, label: "m^2" },
  { pattern: /\b(in\s*\^?2|square\s*in|sq\.?\s*in)\b/i, label: "in^2" },
  { pattern: /\b(cm|centimeters?)\b/i, label: "cm" },
  { pattern: /\b(m|meters?)\b/i, label: "m" },
  { pattern: /\b(in|inches)\b/i, label: "in" },
];

const NUMBER_PATTERN = /-?\d+(?:\.\d+)?/g;

export function parseMathExpression(input: string | undefined | null): ParsedExpression {
  const raw = (input ?? "").trim();
  const normalized = raw.replace(/×/g, "*").replace(/\bx\b/gi, "*").replace(/\s+/g, " ");
  const numbers = (normalized.match(NUMBER_PATTERN) ?? []).map(Number);
  const operators = normalized.match(/[+\-*/=]/g) ?? [];
  let detectedUnit: string | undefined;
  for (const { pattern, label } of UNIT_PATTERNS) {
    if (pattern.test(normalized)) {
      detectedUnit = label;
      break;
    }
  }
  let detectedFormula: ParsedExpression["detectedFormula"];
  if (/(\d+)\s*\*\s*(\d+)/.test(normalized) && /area/i.test(raw)) {
    detectedFormula = "area_rectangle";
  } else if (/2\s*\*\s*\(\s*\d+\s*\+\s*\d+\s*\)/.test(normalized)) {
    detectedFormula = "perimeter_rectangle";
  } else if (operators.filter((o) => o === "+").length >= 2 && numbers.length >= 3) {
    const allSame = numbers.every((n) => n === numbers[0]);
    if (allSame) {
      detectedFormula = "repeated_addition";
    }
  } else if (/(\d+)\s*\*\s*(\d+)/.test(normalized)) {
    detectedFormula = "area_rectangle";
  }
  return {
    raw,
    normalized,
    numbers,
    operators,
    hasUnit: Boolean(detectedUnit),
    detectedUnit,
    detectedFormula,
  };
}

export function detectArithmeticMismatch(
  work: string | undefined,
  finalAnswer: string | number | undefined,
): boolean {
  if (!work || finalAnswer === undefined || finalAnswer === null) return false;
  const parsed = parseMathExpression(work);
  const final = typeof finalAnswer === "number" ? finalAnswer : Number(String(finalAnswer));
  if (!Number.isFinite(final)) return false;
  if (parsed.detectedFormula === "area_rectangle" && parsed.numbers.length >= 2) {
    const product = parsed.numbers[0] * parsed.numbers[1];
    return Math.abs(product - final) > 0.0001;
  }
  if (parsed.detectedFormula === "perimeter_rectangle" && parsed.numbers.length >= 2) {
    const perimeter = 2 * (parsed.numbers[0] + parsed.numbers[1]);
    return Math.abs(perimeter - final) > 0.0001;
  }
  if (parsed.detectedFormula === "repeated_addition" && parsed.numbers.length >= 2) {
    const total = parsed.numbers.reduce((acc, n) => acc + n, 0);
    return Math.abs(total - final) > 0.0001;
  }
  return false;
}
