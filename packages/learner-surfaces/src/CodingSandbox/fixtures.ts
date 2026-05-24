import type { CodingRubric } from "./types.js";

export interface CodingFixtureItem {
  id: string;
  gradeBand: "3-5" | "6-8";
  topic: "variables" | "conditionals" | "loops" | "functions" | "arrays" | "debugging";
  correctness: CodingRubric;
}

export const CODING_FIXTURE_ITEMS: CodingFixtureItem[] = [
  {
    id: "coding-g3-var-js-1",
    gradeBand: "3-5",
    topic: "variables",
    correctness: {
      type: "coding",
      language: "javascript",
      starterCode: "const name = 'Sky';\nconsole.log(name);",
      tests: [{ name: "prints name", kind: "stdout", expected: "Sky" }],
    },
  },
  {
    id: "coding-g3-var-py-2",
    gradeBand: "3-5",
    topic: "variables",
    correctness: {
      type: "coding",
      language: "python",
      starterCode: "pet = 'cat'\nprint(pet)",
      tests: [{ name: "prints pet", kind: "stdout", expected: "cat" }],
    },
  },
  {
    id: "coding-g3-cond-js-3",
    gradeBand: "3-5",
    topic: "conditionals",
    correctness: {
      type: "coding",
      language: "javascript",
      starterCode: "export function bigger(a, b) { return a > b ? a : b; }",
      tests: [{ name: "bigger", kind: "returns", input: [5, 3], expected: 5 }],
    },
  },
  {
    id: "coding-g4-cond-py-4",
    gradeBand: "3-5",
    topic: "conditionals",
    correctness: {
      type: "coding",
      language: "python",
      starterCode: "def sign(n):\n    if n < 0:\n        return 'neg'\n    return 'pos'",
      tests: [{ name: "sign", kind: "returns", input: [-1], expected: "neg" }],
    },
  },
  {
    id: "coding-g4-loop-js-5",
    gradeBand: "3-5",
    topic: "loops",
    correctness: {
      type: "coding",
      language: "javascript",
      starterCode: "export function sumTo(n) { let t=0; for (let i=1;i<=n;i++) t+=i; return t; }",
      tests: [{ name: "sumTo", kind: "returns", input: [4], expected: 10 }],
    },
  },
  {
    id: "coding-g4-loop-py-6",
    gradeBand: "3-5",
    topic: "loops",
    correctness: {
      type: "coding",
      language: "python",
      starterCode: "def countdown(n):\n    for i in range(n, 0, -1):\n        print(i)",
      tests: [{ name: "countdown", kind: "stdout", expected: "3\n2\n1", input: "3" }],
    },
  },
  {
    id: "coding-g5-fn-js-7",
    gradeBand: "3-5",
    topic: "functions",
    correctness: {
      type: "coding",
      language: "javascript",
      starterCode: "export function greet(name) { return `Hi, ${name}!`; }",
      tests: [{ name: "greet", kind: "returns", input: ["Sam"], expected: "Hi, Sam!" }],
    },
  },
  {
    id: "coding-g5-fn-ts-8",
    gradeBand: "3-5",
    topic: "functions",
    correctness: {
      type: "coding",
      language: "typescript",
      starterCode: "export function double(n: number) { return n * 2; }",
      tests: [{ name: "double", kind: "returns", input: [7], expected: 14 }],
    },
  },
  {
    id: "coding-g6-array-js-9",
    gradeBand: "6-8",
    topic: "arrays",
    correctness: {
      type: "coding",
      language: "javascript",
      starterCode: "export function first(items) { return items[0]; }",
      tests: [{ name: "first", kind: "returns", input: [["a", "b"]], expected: "a" }],
    },
  },
  {
    id: "coding-g6-array-ts-10",
    gradeBand: "6-8",
    topic: "arrays",
    correctness: {
      type: "coding",
      language: "typescript",
      starterCode: "export function last(items: number[]) { return items[items.length - 1]; }",
      tests: [{ name: "last", kind: "returns", input: [[1, 2, 3]], expected: 3 }],
    },
  },
  {
    id: "coding-g6-array-py-11",
    gradeBand: "6-8",
    topic: "arrays",
    correctness: {
      type: "coding",
      language: "python",
      starterCode: "def total(nums):\n    return sum(nums)",
      tests: [{ name: "total", kind: "returns", input: [[1, 2, 3]], expected: 6 }],
    },
  },
  {
    id: "coding-g7-debug-js-12",
    gradeBand: "6-8",
    topic: "debugging",
    correctness: {
      type: "coding",
      language: "javascript",
      starterCode: "export function square(n) { return n * n; }",
      tests: [{ name: "square", kind: "returns", input: [6], expected: 36, hidden: true }],
    },
  },
  {
    id: "coding-g7-debug-py-13",
    gradeBand: "6-8",
    topic: "debugging",
    correctness: {
      type: "coding",
      language: "python",
      starterCode: "def reverse_word(word):\n    return word[::-1]",
      tests: [{ name: "reverse_word", kind: "returns", input: ["code"], expected: "edoc", hidden: true }],
    },
  },
  {
    id: "coding-g8-mix-js-14",
    gradeBand: "6-8",
    topic: "loops",
    correctness: {
      type: "coding",
      language: "javascript",
      starterCode: "export function evens(nums) { return nums.filter((n) => n % 2 === 0); }",
      tests: [{ name: "evens", kind: "returns", input: [[1, 2, 3, 4]], expected: [2, 4] }],
    },
  },
  {
    id: "coding-g8-mix-py-15",
    gradeBand: "6-8",
    topic: "functions",
    correctness: {
      type: "coding",
      language: "python",
      starterCode: "def add(a, b):\n    return a + b",
      tests: [{ name: "add", kind: "returns", input: [10, 2], expected: 12 }],
    },
  },
];

