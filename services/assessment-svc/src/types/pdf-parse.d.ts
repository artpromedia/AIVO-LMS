/**
 * Ambient declaration for the `pdf-parse` inner-module path used by
 * `routes/iep.ts`. The package's published `@types/pdf-parse` only
 * declares the top-level `pdf-parse` entry, but we deliberately import
 * `pdf-parse/lib/pdf-parse.js` to skip the package's debug-mode
 * top-level test-file load (which would scan a bundled fixture PDF at
 * require time). The runtime export shape of that inner module is the
 * same default function, so we re-declare it here.
 */
declare module "pdf-parse/lib/pdf-parse.js" {
  interface PdfParseResult {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: unknown;
    text: string;
    version: string;
  }
  type PdfParseFn = (
    dataBuffer: Buffer | Uint8Array,
    options?: Record<string, unknown>,
  ) => Promise<PdfParseResult>;
  const pdfParse: PdfParseFn;
  export default pdfParse;
}
