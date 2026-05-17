export const VI_TOKENS_CSS = `
  .vi-root {
    font-family: var(--font-nunito), 'Nunito', sans-serif;
    background-color: hsl(var(--visual-bg));
    color: hsl(var(--visual-text));
  }
  .vi-root h1, .vi-root h2, .vi-root h3, .vi-root h4 {
    font-family: var(--font-fredoka), 'Quicksand', sans-serif;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
`;

export function ViTokens() {
  return <style dangerouslySetInnerHTML={{ __html: VI_TOKENS_CSS }} />;
}
