import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../server.js";

let app: FastifyInstance;

beforeEach(async () => {
  app = await buildApp({ skipAuth: true });
});

afterEach(async () => {
  await app.close();
});

describe("POST /api/math-recognizer/recognize", () => {
  it("returns 400 when learnerId is missing", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/math-recognizer/recognize",
      payload: { subject: "math" },
    });
    expect(response.statusCode).toBe(400);
  });

  it("recognizes area work and reports correctness", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/math-recognizer/recognize",
      payload: {
        learnerId: "l1",
        subject: "math",
        prompt: "Find the area of the rectangle.",
        typedWork: "8 * 4 cm^2",
        finalAnswer: 32,
        expectedAnswer: 32,
      },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.correctness).toBe(true);
    expect(body.recognizedSteps.length).toBeGreaterThan(0);
  });

  it("flags blank scratchpad with submitted answer", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/math-recognizer/recognize",
      payload: {
        learnerId: "l1",
        subject: "math",
        prompt: "Find the area of the rectangle.",
        finalAnswer: 32,
        strokes: [],
      },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.misconceptions.map((m: { id: string }) => m.id)).toContain(
      "blank_scratchpad_with_answer",
    );
  });

  it("flags perimeter-instead-of-area misconception via the route", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/math-recognizer/recognize",
      payload: {
        learnerId: "l1",
        subject: "math",
        prompt: "Find the area of the rectangle.",
        typedWork: "2 * (8 + 4)",
        finalAnswer: 24,
      },
    });
    const body = response.json();
    expect(body.misconceptions.map((m: { id: string }) => m.id)).toContain(
      "perimeter_instead_of_area",
    );
  });
});
