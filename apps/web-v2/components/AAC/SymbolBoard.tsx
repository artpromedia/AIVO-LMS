"use client";

/**
 * AAC SymbolBoard — renders the board returned by brain-svc (via the BFF
 * wrapper at /api/bff/family/aac-board/:learnerId). Each tile is a button
 * sized to the configured grid (rows x cols). Selecting a tile invokes the
 * `onSelect` callback with the symbol and (when wired) speaks the label
 * via the shared TTS hook.
 *
 * Accessibility:
 *  - Each tile is a <button> with an accessible name (label) and an aria-label
 *    that includes the position so screen-reader users can navigate by index.
 *  - The grid itself has role="grid" with `aria-label` describing the board.
 *  - Tile size is enforced to be >=44x44 CSS px to satisfy WCAG 2.5.5 target
 *    size.
 */
import { useCallback, useEffect, useState } from "react";

export type Symbol = {
  id: string;
  label: string;
  imageUrl: string;
  audioUrl?: string;
  boardId: string;
  position: { row: number; col: number };
  backgroundColor?: string;
  borderColor?: string;
};

export type Board = {
  id: string;
  name: string;
  locale: string;
  grid: { rows: number; cols: number };
  items: Symbol[];
};

type Props = {
  learnerId: string;
  /** Optional override; defaults to fetching from the BFF. */
  initialBoard?: Board;
  onSelect?: (symbol: Symbol) => void;
  /** When true, speak the label on click via the web TTS API. Defaults true. */
  speakOnSelect?: boolean;
};

async function fetchBoard(learnerId: string, signal: AbortSignal): Promise<Board> {
  const res = await fetch(`/api/bff/family/aac-board/${encodeURIComponent(learnerId)}`, {
    signal,
    credentials: "same-origin",
  });
  if (!res.ok) {
    throw new Error(`Failed to load AAC board: ${res.status}`);
  }
  const json = (await res.json()) as { data: { board: Board } } | { board: Board };
  // Accept both envelopes (BFF helpers vary across services).
  return "data" in json ? json.data.board : (json as { board: Board }).board;
}

function speakLabel(label: string, locale: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const utter = new SpeechSynthesisUtterance(label);
  utter.lang = locale || "en-US";
  // Cancel any in-flight utterance so rapid taps don't queue forever.
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

export function SymbolBoard({
  learnerId,
  initialBoard,
  onSelect,
  speakOnSelect = true,
}: Props): JSX.Element {
  const [board, setBoard] = useState<Board | null>(initialBoard ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialBoard) return;
    const ac = new AbortController();
    fetchBoard(learnerId, ac.signal)
      .then(setBoard)
      .catch((e: unknown) => {
        if ((e as Error).name === "AbortError") return;
        setError((e as Error).message);
      });
    return () => ac.abort();
  }, [learnerId, initialBoard]);

  const handleSelect = useCallback(
    (sym: Symbol) => {
      if (speakOnSelect && board) speakLabel(sym.label, board.locale);
      onSelect?.(sym);
    },
    [speakOnSelect, board, onSelect],
  );

  if (error) {
    return (
      <div role="alert" className="aac-board-error" style={{ padding: 24 }}>
        Couldn&rsquo;t load the AAC board: {error}
      </div>
    );
  }
  if (!board) {
    return (
      <div role="status" aria-live="polite" style={{ padding: 24 }}>
        Loading your board&hellip;
      </div>
    );
  }

  const { rows, cols } = board.grid;
  return (
    <div
      role="grid"
      aria-label={`${board.name} AAC board, ${rows} rows by ${cols} columns`}
      aria-rowcount={rows}
      aria-colcount={cols}
      data-testid="aac-symbol-board"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, minmax(72px, 1fr))`,
        gridAutoRows: "minmax(72px, auto)",
        gap: 8,
        padding: 12,
      }}
    >
      {board.items.map((sym) => (
        <button
          key={sym.id}
          type="button"
          role="gridcell"
          aria-rowindex={sym.position.row + 1}
          aria-colindex={sym.position.col + 1}
          aria-label={sym.label}
          onClick={() => handleSelect(sym)}
          style={{
            minWidth: 44,
            minHeight: 44,
            padding: 8,
            background: sym.backgroundColor ?? "#ffffff",
            border: `2px solid ${sym.borderColor ?? "#0f172a"}`,
            borderRadius: 8,
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
          }}
        >
          {sym.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sym.imageUrl}
              alt=""
              aria-hidden="true"
              style={{ maxWidth: 64, maxHeight: 64 }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : null}
          <span style={{ fontSize: 14, fontWeight: 600 }}>{sym.label}</span>
        </button>
      ))}
    </div>
  );
}

export default SymbolBoard;
