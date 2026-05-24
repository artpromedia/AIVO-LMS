import type { InkStroke } from "../ink/stroke-model.js";

function escapeXml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function pathForStroke(stroke: InkStroke): string {
  if (stroke.points.length === 0) return "";
  const [first, ...rest] = stroke.points;
  const commands = [`M ${first.x} ${first.y}`];
  for (const point of rest) commands.push(`L ${point.x} ${point.y}`);
  return commands.join(" ");
}

function encodeBase64(input: string): string {
  const utf8 = encodeURIComponent(input).replace(
    /%([0-9A-F]{2})/g,
    (_match, p1: string) => String.fromCharCode(Number.parseInt(p1, 16)),
  );
  if (typeof globalThis.btoa === "function") {
    return globalThis.btoa(utf8);
  }
  return "";
}

export function buildDrawingSvg(strokes: InkStroke[], width: number, height: number): string {
  const paths = strokes
    .map((stroke) => {
      const d = pathForStroke(stroke);
      if (!d) return "";
      const strokeColor = stroke.color ?? (stroke.tool === "highlighter" ? "#f59e0b" : "#1f2937");
      const strokeOpacity = stroke.tool === "highlighter" ? 0.4 : 1;
      return `<path d="${escapeXml(d)}" fill="none" stroke="${escapeXml(strokeColor)}" stroke-opacity="${strokeOpacity}" stroke-width="${stroke.width}" stroke-linecap="round" stroke-linejoin="round" />`;
    })
    .filter(Boolean)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${paths}</svg>`;
}

export async function buildDrawingPngDataUrl(
  strokes: InkStroke[],
  width: number,
  height: number,
): Promise<string> {
  const svg = buildDrawingSvg(strokes, width, height);

  if (typeof document === "undefined") {
    return `data:image/png;base64,${encodeBase64(svg)}`;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return `data:image/png;base64,${encodeBase64(svg)}`;
  }

  const image = new Image();
  const svgUrl = `data:image/svg+xml;base64,${encodeBase64(svg)}`;

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Could not rasterize drawing SVG."));
    image.src = svgUrl;
  });

  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0);
  return canvas.toDataURL("image/png");
}

export function buildDrawingSvgDataUrl(strokes: InkStroke[], width: number, height: number): string {
  const svg = buildDrawingSvg(strokes, width, height);
  return `data:image/svg+xml;base64,${encodeBase64(svg)}`;
}
