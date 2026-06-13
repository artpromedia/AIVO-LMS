/**
 * IEP upload in-code hardening (Sprint C-10, Decision D6).
 *
 * `assertPdfSafety` is the pure, exported gate the `POST /api/iep/upload-pdf`
 * handler runs on the raw bytes BEFORE pdf-parse / the LLM. It is defense in
 * depth, NOT antivirus — actual AV is a named follow-up. These tests pin:
 *   - a valid PDF (correct magic bytes, no active content) passes;
 *   - bad magic bytes are rejected (415 not_a_pdf);
 *   - a non-PDF content-type is rejected (415 unsupported_content_type);
 *   - encrypted PDFs are rejected (422 pdf_encrypted);
 *   - active-content PDFs (/JavaScript, /Launch, /EmbeddedFile, /OpenAction)
 *     are rejected (422 pdf_active_content).
 *
 * The 10 MB / 413 oversize path is enforced by the multipart plugin's
 * `toBuffer()` (FST_REQ_FILE_TOO_LARGE → 413) and is unchanged by this sprint —
 * the hardening runs only after a buffer is successfully read, so the existing
 * 413 behaviour is preserved.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { assertPdfSafety } from "../src/routes/iep.js";

/** A minimal well-formed PDF byte sequence (header + trivial body + EOF). */
function validPdf(): Buffer {
  return Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
      "2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\n" +
      "trailer<</Root 1 0 R>>\n%%EOF",
    "latin1",
  );
}

test("a valid PDF with application/pdf passes", () => {
  const res = assertPdfSafety(validPdf(), "application/pdf");
  assert.equal(res.ok, true);
});

test("a valid PDF passes when the content-type is omitted (sniff is the gate)", () => {
  assert.equal(assertPdfSafety(validPdf(), undefined).ok, true);
  assert.equal(assertPdfSafety(validPdf(), "application/octet-stream").ok, true);
});

test("bad magic bytes are rejected as not_a_pdf (415)", () => {
  // A renamed .exe / arbitrary payload that does not start with %PDF-.
  const notPdf = Buffer.from("MZ\x90\x00 this is not a pdf at all, just bytes", "latin1");
  const res = assertPdfSafety(notPdf, "application/pdf");
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.status, 415);
  assert.equal(res.code, "not_a_pdf");
});

test("a disallowed content-type is rejected (415 unsupported_content_type)", () => {
  const res = assertPdfSafety(validPdf(), "image/png");
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.status, 415);
  assert.equal(res.code, "unsupported_content_type");
});

test("an encrypted PDF (/Encrypt) is rejected (422 pdf_encrypted)", () => {
  const enc = Buffer.from(
    "%PDF-1.6\ntrailer<</Root 1 0 R/Encrypt 9 0 R/ID[<abc><def>]>>\n%%EOF",
    "latin1",
  );
  const res = assertPdfSafety(enc, "application/pdf");
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.status, 422);
  assert.equal(res.code, "pdf_encrypted");
});

test("an active-content PDF (/JavaScript) is rejected (422 pdf_active_content)", () => {
  const js = Buffer.from(
    "%PDF-1.5\n1 0 obj<</Type/Action/S/JavaScript/JS(app.alert\\(1\\);)>>endobj\n%%EOF",
    "latin1",
  );
  const res = assertPdfSafety(js, "application/pdf");
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.status, 422);
  assert.equal(res.code, "pdf_active_content");
});

test("an embedded-launch PDF (/Launch) is rejected as active content", () => {
  const launch = Buffer.from(
    "%PDF-1.5\n1 0 obj<</Type/Action/S/Launch/Win<</F(cmd.exe)>>>>endobj\n%%EOF",
    "latin1",
  );
  const res = assertPdfSafety(launch, "application/pdf");
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.code, "pdf_active_content");
});

test("an OpenAction auto-run PDF is rejected as active content", () => {
  const open = Buffer.from(
    "%PDF-1.7\n1 0 obj<</Type/Catalog/OpenAction 2 0 R>>endobj\n%%EOF",
    "latin1",
  );
  const res = assertPdfSafety(open, "application/pdf");
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.code, "pdf_active_content");
});
