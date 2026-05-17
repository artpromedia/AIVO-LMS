export interface InkStrokePoint {
  x: number;
  y: number;
  t?: number;
}

export interface InkStrokeLike {
  id?: string;
  points: InkStrokePoint[];
  tool?: string;
}

export interface StrokeFeatures {
  strokeCount: number;
  totalPoints: number;
  isBlank: boolean;
  hasErasers: boolean;
  averageStrokeLength: number;
}

export function extractStrokeFeatures(strokes: InkStrokeLike[] | undefined): StrokeFeatures {
  if (!strokes || strokes.length === 0) {
    return {
      strokeCount: 0,
      totalPoints: 0,
      isBlank: true,
      hasErasers: false,
      averageStrokeLength: 0,
    };
  }
  let totalPoints = 0;
  let totalLength = 0;
  let hasErasers = false;
  for (const stroke of strokes) {
    if (stroke.tool === "eraser") {
      hasErasers = true;
    }
    totalPoints += stroke.points.length;
    for (let i = 1; i < stroke.points.length; i++) {
      const dx = stroke.points[i].x - stroke.points[i - 1].x;
      const dy = stroke.points[i].y - stroke.points[i - 1].y;
      totalLength += Math.hypot(dx, dy);
    }
  }
  return {
    strokeCount: strokes.length,
    totalPoints,
    isBlank: totalPoints === 0,
    hasErasers,
    averageStrokeLength: strokes.length > 0 ? totalLength / strokes.length : 0,
  };
}
