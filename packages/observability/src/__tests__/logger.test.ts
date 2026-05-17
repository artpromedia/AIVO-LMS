import { describe, it, expect, beforeEach } from "vitest";
import { sanitize, createLogger } from "../index.js";

describe("sanitize()", () => {
  it("strips keys matching /token|key|secret|password|credential|auth/i at the top level", () => {
    const input = { userId: "123", authToken: "abc", name: "Alice" };
    const result = sanitize(input);
    expect((result as any).authToken).toBe("[REDACTED]");
    expect((result as any).name).toBe("Alice");
    expect((result as any).userId).toBe("123");
  });

  it("strips keys at nested depth", () => {
    const input = { user: { apiKey: "sk-secret", name: "Bob" } };
    const result = sanitize(input) as any;
    expect(result.user.apiKey).toBe("[REDACTED]");
    expect(result.user.name).toBe("Bob");
  });

  it("strips 'password' key", () => {
    const result = sanitize({ password: "hunter2", ok: true }) as any;
    expect(result.password).toBe("[REDACTED]");
    expect(result.ok).toBe(true);
  });

  it("strips 'secret' key", () => {
    const result = sanitize({ jwtSecret: "abc123" }) as any;
    expect(result.jwtSecret).toBe("[REDACTED]");
  });

  it("strips 'credential' key", () => {
    const result = sanitize({ credentialHash: "xyz" }) as any;
    expect(result.credentialHash).toBe("[REDACTED]");
  });

  it("does not mutate the original object", () => {
    const input = { token: "abc", safe: "data" };
    sanitize(input);
    expect(input.token).toBe("abc");
  });

  it("handles arrays by sanitising each element", () => {
    const input = [{ apiKey: "k1", x: 1 }, { apiKey: "k2", x: 2 }];
    const result = sanitize(input) as any[];
    expect(result[0].apiKey).toBe("[REDACTED]");
    expect(result[0].x).toBe(1);
  });

  it("handles null and primitive values without throwing", () => {
    expect(sanitize(null)).toBeNull();
    expect(sanitize(42 as any)).toBe(42);
    expect(sanitize("hello" as any)).toBe("hello");
  });
});

describe("createLogger()", () => {
  it("returns an object with info, warn, error, debug methods", () => {
    const logger = createLogger("test-svc");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  it("does not throw when called with sanitised data", () => {
    const logger = createLogger("test-svc");
    expect(() => logger.info("test message", { userId: "x", token: "secret" })).not.toThrow();
  });
});
