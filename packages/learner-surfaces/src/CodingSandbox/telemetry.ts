import type { CodingLanguage, CodingRubricTest } from "./types.js";

export function buildSnippetTelemetry(params: {
  source: string;
  language: CodingLanguage;
  tests: CodingRubricTest[];
  captureSource?: boolean;
}) {
  const hidden = params.tests.filter((t) => t.hidden).length;
  const visible = params.tests.length - hidden;
  return {
    language: params.language,
    snippetLength: params.source.length,
    testCount: params.tests.length,
    hiddenTestCount: hidden,
    visibleTestCount: visible,
    source: params.captureSource ? params.source : undefined,
  };
}

