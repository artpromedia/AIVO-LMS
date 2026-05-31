/**
 * Minimal ambient declarations for the WHATWG URL globals used by
 * `deep-links.ts`. Both Node.js (>= 10) and every modern browser
 * expose these on `globalThis`, so we don't need to depend on
 * `@types/node` or `lib.dom` — that would pull in much more than
 * this pure-TS package wants to know about.
 */
declare class URL {
  constructor(url: string, base?: string | URL);
  pathname: string;
  search: string;
  hash: string;
  href: string;
  searchParams: URLSearchParams;
}

declare class URLSearchParams {
  constructor(init?: string | Record<string, string> | URLSearchParams);
  toString(): string;
  get(name: string): string | null;
  set(name: string, value: string): void;
  append(name: string, value: string): void;
}
