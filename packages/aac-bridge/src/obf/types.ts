/**
 * OBF (Open Board Format) v1.0 types used internally by the importer and exporter.
 */

export interface OBFButton {
  id: string | number;
  label?: string;
  image_id?: string | number;
  border_color?: string;
  background_color?: string;
  load_board?: { id?: string; path?: string };
  vocalization?: string;
  hidden?: boolean;
  ext?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface OBFImage {
  id: string | number;
  url?: string;
  path?: string;
  content_type?: string;
  width?: number;
  height?: number;
  [key: string]: unknown;
}

export interface OBFGrid {
  rows: number;
  columns: number;
  order?: (string | number | null)[][];
}

export interface OBFBoard {
  id?: string;
  name?: string;
  locale?: string;
  buttons?: OBFButton[];
  images?: OBFImage[];
  grid?: OBFGrid;
  sounds?: unknown[];
  license?: unknown;
  format?: string;
  [key: string]: unknown;
}

export interface OBFManifest {
  format?: string;
  root?: string;
  paths?: {
    boards?: Record<string, string>;
    images?: Record<string, string>;
    sounds?: Record<string, string>;
  };
}
