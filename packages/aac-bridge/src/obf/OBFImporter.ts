/**
 * OBFImporter — parses Open Board Format (OBF/OBZ) data into AIVO SymbolBoard objects.
 */
import { unzipSync } from "fflate";
import type { SymbolBoard, SymbolItem } from "../types.js";
import type { OBFBoard, OBFManifest } from "./types.js";

function buildBoardId(raw: unknown): string {
  if (typeof raw === "string" && raw.length > 0) return raw;
  if (typeof raw === "number") return String(raw);
  return crypto.randomUUID();
}

function resolveImageUrl(
  buttonImageId: string | number | undefined,
  images: OBFBoard["images"],
): string {
  if (!buttonImageId || !images) return "";
  const img = images.find((i) => String(i.id) === String(buttonImageId));
  return img?.url ?? img?.path ?? "";
}

function boardFromOBF(raw: OBFBoard, boardId: string): SymbolBoard {
  const buttons = raw.buttons ?? [];
  const images = raw.images ?? [];
  const grid = raw.grid ?? { rows: 0, columns: 0 };
  const gridOrder: (string | number | null)[][] = grid.order ?? [];

  // Build position map: buttonId → { row, col }
  const posMap = new Map<string, { row: number; col: number }>();
  gridOrder.forEach((row, ri) => {
    row.forEach((cell, ci) => {
      if (cell != null) posMap.set(String(cell), { row: ri, col: ci });
    });
  });

  const items: SymbolItem[] = buttons
    .filter((b) => !b.hidden)
    .map((b) => {
      const id = String(b.id);
      return {
        id,
        label: b.label ?? "",
        imageUrl: resolveImageUrl(b.image_id, images),
        boardId,
        position: posMap.get(id) ?? { row: 0, col: 0 },
        backgroundColor: b.background_color,
        borderColor: b.border_color,
      };
    });

  return {
    id: boardId,
    name: raw.name ?? "Unnamed Board",
    locale: raw.locale ?? "en",
    items,
    grid: {
      rows: grid.rows ?? 0,
      cols: grid.columns ?? 0,
    },
  };
}

export function validateOBF(json: unknown): string[] {
  const errors: string[] = [];
  if (typeof json !== "object" || json === null) {
    errors.push("OBF document must be a JSON object");
    return errors;
  }
  const doc = json as Record<string, unknown>;
  if (!Array.isArray(doc.buttons)) errors.push('Missing required field "buttons" (array)');
  if (doc.grid !== undefined && typeof doc.grid !== "object")
    errors.push('"grid" must be an object');
  return errors;
}

export function parseOBF(json: unknown): SymbolBoard {
  const errors = validateOBF(json);
  if (errors.length > 0) throw new Error(`Invalid OBF: ${errors.join("; ")}`);
  const raw = json as OBFBoard;
  const id = buildBoardId(raw.id);
  return boardFromOBF(raw, id);
}

export async function parseOBZ(zipBuffer: ArrayBuffer): Promise<SymbolBoard[]> {
  const bytes = new Uint8Array(zipBuffer);
  const files = unzipSync(bytes);

  // Locate manifest.json
  const manifestEntry = Object.entries(files).find(
    ([name]) => name === "manifest.json" || name.endsWith("/manifest.json"),
  );
  if (!manifestEntry) throw new Error("OBZ file missing manifest.json");

  const manifest: OBFManifest = JSON.parse(new TextDecoder().decode(manifestEntry[1]));
  const boardPaths = manifest.paths?.boards ?? {};

  const boards: SymbolBoard[] = [];
  for (const [boardKey, boardPath] of Object.entries(boardPaths)) {
    const normalised = boardPath.replace(/^\//, "");
    const entry = files[normalised] ?? files[boardPath];
    if (!entry) continue;
    const raw = JSON.parse(new TextDecoder().decode(entry)) as OBFBoard;
    boards.push(boardFromOBF(raw, buildBoardId(raw.id ?? boardKey)));
  }
  return boards;
}
