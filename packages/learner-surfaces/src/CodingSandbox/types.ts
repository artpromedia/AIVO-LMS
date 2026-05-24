export type CodingLanguage = "javascript" | "typescript" | "python";

export interface CodingRubricTest {
  name: string;
  hidden?: boolean;
  kind: "stdout" | "returns";
  input?: string | unknown[];
  expected: string | unknown;
}

export interface CodingRubric {
  type: "coding";
  language: CodingLanguage;
  starterCode: string;
  tests: CodingRubricTest[];
}

export interface CodingOutputCapture {
  stdout: string;
  stderr: string;
  runtimeMs: number;
  returnValue?: unknown;
}

export interface CodingTestResult {
  name: string;
  hidden: boolean;
  kind: "stdout" | "returns";
  pass: boolean;
  runtimeMs: number;
  expected: unknown;
  actual: unknown;
  output: CodingOutputCapture;
}

export interface CodingRunResult {
  output: CodingOutputCapture;
  tests: CodingTestResult[];
  passed: number;
  failed: number;
}
