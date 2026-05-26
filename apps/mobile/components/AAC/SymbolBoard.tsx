/**
 * Mobile AAC SymbolBoard.
 *
 * Consumes the board returned by the BFF wrapper at
 * `/api/bff/family/aac-board/:learnerId`. Each tile speaks the label using
 * the mobile TTS factory (defaults to expo-speech offline for fluent
 * tap-to-talk; premium voices are configured via EXPO_PUBLIC_TTS_PROVIDER).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { getTTSProvider } from "../../lib/tts";

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
  apiBaseUrl?: string;
  initialBoard?: Board;
  onSelect?: (symbol: Symbol) => void;
};

async function fetchBoard(
  baseUrl: string,
  learnerId: string,
  signal: AbortSignal,
): Promise<Board> {
  const res = await fetch(
    `${baseUrl}/api/bff/family/aac-board/${encodeURIComponent(learnerId)}`,
    { signal },
  );
  if (!res.ok) throw new Error(`Failed to load AAC board: ${res.status}`);
  const json = (await res.json()) as { data?: { board: Board }; board?: Board };
  return (json.data?.board ?? json.board) as Board;
}

export function SymbolBoard({
  learnerId,
  apiBaseUrl,
  initialBoard,
  onSelect,
}: Props): JSX.Element {
  const [board, setBoard] = useState<Board | null>(initialBoard ?? null);
  const [error, setError] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const tts = useMemo(() => getTTSProvider(), []);
  const base =
    apiBaseUrl ??
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    process.env.EXPO_PUBLIC_WEB_BASE_URL ??
    "http://localhost:5000";

  useEffect(() => {
    if (initialBoard) return;
    const ac = new AbortController();
    fetchBoard(base, learnerId, ac.signal)
      .then(setBoard)
      .catch((e: unknown) => {
        if ((e as Error).name === "AbortError") return;
        setError((e as Error).message);
      });
    return () => ac.abort();
  }, [base, learnerId, initialBoard]);

  const handlePress = useCallback(
    async (sym: Symbol) => {
      onSelect?.(sym);
      if (tts.speakInline) {
        await tts.speakInline({
          text: sym.label,
          voiceId: "kid_friendly",
          languageCode: board?.locale ?? "en-US",
          speed: 1,
          pronunciationOverrides: [],
        });
      }
    },
    [onSelect, tts, board],
  );

  if (error) {
    return (
      <View style={styles.center} accessibilityRole="alert">
        <Text>Couldn&rsquo;t load the AAC board: {error}</Text>
      </View>
    );
  }
  if (!board) {
    return (
      <View style={styles.center} accessibilityLiveRegion="polite">
        <ActivityIndicator />
        <Text>Loading your board…</Text>
      </View>
    );
  }

  const cols = board.grid.cols;
  const gap = 8;
  const padding = 12;
  const tileWidth = Math.max(72, Math.floor((width - padding * 2 - gap * (cols - 1)) / cols));

  return (
    <View
      style={[styles.grid, { padding }]}
      accessibilityLabel={`${board.name} AAC board, ${board.grid.rows} rows by ${cols} columns`}
    >
      {board.items.map((sym) => (
        <Pressable
          key={sym.id}
          onPress={() => handlePress(sym)}
          accessibilityRole="button"
          accessibilityLabel={sym.label}
          style={({ pressed }) => [
            styles.tile,
            {
              width: tileWidth,
              height: tileWidth,
              backgroundColor: sym.backgroundColor ?? "#ffffff",
              borderColor: sym.borderColor ?? "#0f172a",
              opacity: pressed ? 0.85 : 1,
              marginRight: gap,
              marginBottom: gap,
            },
          ]}
        >
          {sym.imageUrl ? (
            <Image
              source={{ uri: sym.imageUrl }}
              style={styles.image}
              accessible={false}
              onError={() => {
                // Image failures are non-fatal; the label remains.
              }}
            />
          ) : null}
          <Text style={styles.label}>{sym.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { padding: 24, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  tile: {
    borderWidth: 2,
    borderRadius: 8,
    minWidth: 44,
    minHeight: 44,
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  image: { width: 64, height: 64, marginBottom: 4 },
  label: { fontSize: 14, fontWeight: "600", textAlign: "center" },
});

export default SymbolBoard;
