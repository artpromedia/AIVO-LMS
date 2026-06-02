/**
 * Sprint 7 (learner roadmap): renders text that may contain inline
 * (`$x^2$`) or display-mode (`$$\\frac{a}{b}$$`) LaTeX math fragments.
 *
 * Implementation notes:
 *  - Uses `katex.renderToString`, which returns pre-escaped HTML, so
 *    handing the output to `dangerouslySetInnerHTML` does not
 *    re-introduce XSS. `trust: false` blocks `\href` and similar.
 *  - Works in both Server Components (renders at request time) and
 *    Client Components (renders in the browser). Either way the same
 *    HTML is produced.
 *  - Anything that does not look like a `$…$` / `$$…$$` segment is
 *    rendered as plain text, preserving whitespace and special chars.
 *
 * `throwOnError: false` keeps a single malformed expression from
 * breaking the whole lesson card — KaTeX renders the bad source in
 * red and the rest of the beat continues to render normally.
 */
import katex from "katex";
import "katex/dist/katex.min.css";

type Token = { kind: "text"; value: string } | { kind: "math"; value: string; display: boolean };

const PATTERN = /\$\$([^$]+?)\$\$|\$([^$\n]+?)\$/g;

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let lastIndex = 0;
  for (const match of input.matchAll(PATTERN)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      tokens.push({ kind: "text", value: input.slice(lastIndex, start) });
    }
    if (match[1] !== undefined) {
      tokens.push({ kind: "math", value: match[1], display: true });
    } else if (match[2] !== undefined) {
      tokens.push({ kind: "math", value: match[2], display: false });
    }
    lastIndex = start + match[0].length;
  }
  if (lastIndex < input.length) {
    tokens.push({ kind: "text", value: input.slice(lastIndex) });
  }
  return tokens.length > 0 ? tokens : [{ kind: "text", value: input }];
}

function renderMath(source: string, display: boolean): string {
  return katex.renderToString(source, {
    displayMode: display,
    throwOnError: false,
    output: "html",
    strict: "ignore",
    trust: false,
  });
}

export function MathText({
  children,
  className,
}: {
  readonly children: string;
  readonly className?: string;
}) {
  const tokens = tokenize(children);
  // Fast path — nothing math-like in the string.
  if (tokens.length === 1 && tokens[0].kind === "text") {
    return <span className={className}>{children}</span>;
  }
  return (
    <span className={className}>
      {tokens.map((t, i) =>
        t.kind === "text" ? (
          <span key={i}>{t.value}</span>
        ) : (
          <span
            key={i}
            className={t.display ? "block my-2" : "inline-block align-baseline"}
            // KaTeX's HTML output is pre-escaped; trust the renderer.
            dangerouslySetInnerHTML={{ __html: renderMath(t.value, t.display) }}
          />
        ),
      )}
    </span>
  );
}
