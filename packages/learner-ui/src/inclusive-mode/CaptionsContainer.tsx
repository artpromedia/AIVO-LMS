/**
 * CaptionsContainer — accessible container for video/audio media captions
 * plus an ARIA live region for announcing transient messages.
 *
 * Two child regions:
 *   - .captions-track: a `region` landmark intended to host visible caption
 *     cues. Consumers render <track> kind="captions" inside their media
 *     element AND mirror the cue text here for users who need higher
 *     contrast or larger sizing than the native <track> renderer provides.
 *   - .captions-live: an aria-live="polite" region that announces media
 *     state changes ("Paused", "Captions on", etc.).
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export interface CaptionsApi {
  announce: (message: string) => void;
  setCurrentCue: (text: string | null) => void;
  currentCue: string | null;
}

const CaptionsContext = createContext<CaptionsApi | null>(null);

export interface CaptionsContainerProps {
  /** Locale for the captions region (defaults to "en"). */
  locale?: string;
  /** Optional cue size override; defaults to 1rem. */
  fontSize?: string;
  /** When true, captions are visible. When false, the visual track is hidden
   *  but the live region still announces media state changes. */
  visible?: boolean;
  children: ReactNode;
}

export function CaptionsContainer({
  locale = "en",
  fontSize = "1.125rem",
  visible = true,
  children,
}: CaptionsContainerProps): JSX.Element {
  const [currentCue, setCurrentCueState] = useState<string | null>(null);
  const liveRef = useRef<HTMLDivElement | null>(null);

  const announce = useCallback((message: string) => {
    if (liveRef.current) {
      // Toggle the text to force screen readers to re-announce identical
      // messages (e.g. successive "Paused").
      liveRef.current.textContent = "";
      // Use a microtask-style delay so the empty + new text are seen as
      // distinct mutations.
      Promise.resolve().then(() => {
        if (liveRef.current) liveRef.current.textContent = message;
      });
    }
  }, []);

  const setCurrentCue = useCallback((text: string | null) => {
    setCurrentCueState(text);
  }, []);

  const api = useMemo<CaptionsApi>(
    () => ({ announce, setCurrentCue, currentCue }),
    [announce, setCurrentCue, currentCue],
  );

  return (
    <CaptionsContext.Provider value={api}>
      <div className="captions-container">
        {children}
        {visible ? (
          <div
            role="region"
            aria-label="Captions"
            lang={locale}
            className="captions-track"
            style={{
              minHeight: "2.5em",
              padding: "8px 12px",
              background: "rgba(0,0,0,0.78)",
              color: "#ffffff",
              fontSize,
              borderRadius: 4,
              marginTop: 8,
            }}
          >
            {currentCue ?? ""}
          </div>
        ) : null}
        <div
          ref={liveRef}
          aria-live="polite"
          aria-atomic="true"
          className="captions-live"
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: "hidden",
            clip: "rect(0,0,0,0)",
            whiteSpace: "nowrap",
            border: 0,
          }}
        />
      </div>
    </CaptionsContext.Provider>
  );
}

export function useCaptions(): CaptionsApi {
  const ctx = useContext(CaptionsContext);
  if (!ctx) {
    throw new Error("useCaptions must be used inside <CaptionsContainer>.");
  }
  return ctx;
}

export default CaptionsContainer;
