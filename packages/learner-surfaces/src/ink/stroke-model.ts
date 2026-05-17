export interface InkPoint {
  x: number;
  y: number;
  t: number;
  pressure?: number;
}

export interface InkStroke {
  id: string;
  tool: "pencil" | "highlighter" | "eraser";
  points: InkPoint[];
  width: number;
  createdAt: string;
}

let fallbackStrokeCounter = 0;

function createStrokeId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  fallbackStrokeCounter += 1;
  return `stroke-${Date.now()}-${fallbackStrokeCounter}`;
}

export function createStroke(
  tool: InkStroke["tool"],
  point: InkPoint,
  width: number,
  id: string = createStrokeId(),
): InkStroke {
  return {
    id,
    tool,
    width,
    createdAt: new Date(point.t).toISOString(),
    points: [point],
  };
}

export function appendStrokePoint(stroke: InkStroke, point: InkPoint): InkStroke {
  return {
    ...stroke,
    points: [...stroke.points, point],
  };
}

export function addStroke(strokes: InkStroke[], stroke: InkStroke): InkStroke[] {
  return [...strokes, stroke];
}

export function undoStroke(strokes: InkStroke[]): InkStroke[] {
  return strokes.slice(0, -1);
}

export function clearStrokes(): InkStroke[] {
  return [];
}

export function exportStrokes(strokes: InkStroke[]): InkStroke[] {
  return strokes.map((stroke) => ({
    ...stroke,
    points: stroke.points.map((point) => ({ ...point })),
  }));
}
