import { describe, it, expect } from "vitest";
import {
  base64ByteLength,
  describeHomeworkAttachment,
  MAX_HOMEWORK_ATTACHMENT_BYTES,
  parseHomeworkAttachment,
} from "./attachments";

const TINY_PNG_BASE64 =
  // 1x1 transparent PNG
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=";

describe("parseHomeworkAttachment", () => {
  it("accepts a valid PNG payload", () => {
    const result = parseHomeworkAttachment({
      mimeType: "image/png",
      filename: "work.png",
      dataBase64: TINY_PNG_BASE64,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.attachment.mimeType).toBe("image/png");
    expect(result.attachment.filename).toBe("work.png");
    expect(result.attachment.sizeBytes).toBeGreaterThan(0);
  });

  it("treats a missing or empty filename as null", () => {
    const result = parseHomeworkAttachment({
      mimeType: "image/png",
      filename: "",
      dataBase64: TINY_PNG_BASE64,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.attachment.filename).toBeNull();
  });

  it("rejects disallowed mime types", () => {
    const result = parseHomeworkAttachment({
      mimeType: "application/zip",
      dataBase64: TINY_PNG_BASE64,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("invalid_mime");
  });

  it("rejects payloads with invalid base64 characters", () => {
    const result = parseHomeworkAttachment({
      mimeType: "image/png",
      dataBase64: "not base64!!",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("invalid_base64");
  });

  it("rejects payloads larger than the size cap", () => {
    // Build a base64 string that decodes to MAX + 4 bytes.
    const overBytes = MAX_HOMEWORK_ATTACHMENT_BYTES + 4;
    const overChars = Math.ceil(overBytes / 3) * 4;
    const dataBase64 = "A".repeat(overChars);
    const result = parseHomeworkAttachment({
      mimeType: "application/pdf",
      dataBase64,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("too_large");
  });

  it("rejects non-object payloads", () => {
    expect(parseHomeworkAttachment(null).ok).toBe(false);
    expect(parseHomeworkAttachment("nope").ok).toBe(false);
  });
});

describe("base64ByteLength", () => {
  it("returns 0 for an empty string", () => {
    expect(base64ByteLength("")).toBe(0);
  });

  it("accounts for one and two padding chars", () => {
    expect(base64ByteLength("AAAA")).toBe(3); // no padding
    expect(base64ByteLength("AAA=")).toBe(2); // one pad
    expect(base64ByteLength("AA==")).toBe(1); // two pads
  });
});

describe("describeHomeworkAttachment", () => {
  it("uses the filename when present", () => {
    const label = describeHomeworkAttachment({
      mimeType: "image/png",
      filename: "math.png",
      sizeBytes: 2048,
      dataBase64: "AA==",
    });
    expect(label).toContain("math.png");
    expect(label).toContain("KB");
  });

  it("falls back to a friendly kind label", () => {
    const label = describeHomeworkAttachment({
      mimeType: "application/pdf",
      filename: null,
      sizeBytes: 2 * 1024 * 1024,
      dataBase64: "AA==",
    });
    expect(label.startsWith("PDF")).toBe(true);
    expect(label).toContain("MB");
  });
});
