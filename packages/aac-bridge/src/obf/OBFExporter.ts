/**
 * OBFExporter — inverse of OBFImporter.parseOBF().
 * Converts an AIVO SymbolBoard back to a valid OBF v1.0 JSON object.
 */
import type { SymbolBoard, SymbolItem } from "../types.js";
import { validateOBF } from "./OBFImporter.js";

function buildGrid(items: SymbolItem[], rows: number, cols: number): object {
  // Initialise order matrix with nulls.
  const order: (string | null)[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(null),
  );

  for (const item of items) {
    const r = item.position.row;
    const c = item.position.col;
    if (r >= 0 && r < rows && c >= 0 && c < cols) {
      order[r][c] = item.id;
    }
  }

  return { rows, columns: cols, order };
}

export function exportToOBF(board: SymbolBoard): object {
  const imageIdMap = new Map<string, string>();
  const images: object[] = [];

  // Create a synthetic image entry for each item that has an imageUrl.
  board.items.forEach((item) => {
    if (item.imageUrl) {
      const imgId = `img_${item.id}`;
      imageIdMap.set(item.id, imgId);
      images.push({
        id: imgId,
        url: item.imageUrl,
        content_type: "image/png",
      });
    }
  });

  const buttons: object[] = board.items.map((item) => {
    const btn: Record<string, unknown> = {
      id: item.id,
      label: item.label,
    };
    const imgId = imageIdMap.get(item.id);
    if (imgId) btn.image_id = imgId;
    if (item.backgroundColor) btn.background_color = item.backgroundColor;
    if (item.borderColor) btn.border_color = item.borderColor;
    return btn;
  });

  const obf = {
    format: "open-board-0.1",
    id: board.id,
    name: board.name,
    locale: board.locale ?? "en",
    buttons,
    images,
    grid: buildGrid(board.items, board.grid.rows, board.grid.cols),
  };

  const errors = validateOBF(obf);
  if (errors.length > 0) {
    throw new Error(`exportToOBF produced invalid OBF: ${errors.join("; ")}`);
  }

  return obf;
}
