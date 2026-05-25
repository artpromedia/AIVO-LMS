/**
 * Zip lookup fallback (Sprint A — completion plan).
 *
 * Only fires when the NCES-seeded `zip_district` table has no row for
 * a given zip. Implementations call a third-party geocoder to recover
 * the state + county, then map county → districts as a last-resort
 * disambiguation. Never called in the per-keystroke hot path; the
 * lookup route calls it at most once per submitted form.
 *
 * Default provider is `Geocodio` (US-focused, free tier sufficient for
 * the long tail of unmapped zips). The provider is selected by
 * `ZIP_LOOKUP_FALLBACK_PROVIDER` and gated by its API key env var
 * (`GEOCODIO_API_KEY`). When unconfigured the resolver returns
 * `disabled` so the caller surfaces the manual override UI cleanly.
 */
export interface ZipFallbackLocation {
  zip: string;
  state: string;
  county?: string;
  countyFips?: string;
}

export type ZipFallbackResult =
  | { status: "ok"; location: ZipFallbackLocation; provider: string }
  | { status: "miss"; provider: string }
  | { status: "disabled" }
  | { status: "error"; provider: string; reason: string };

export interface ZipLookupFallback {
  readonly name: string;
  resolve(zip: string): Promise<ZipFallbackResult>;
}

class NullFallback implements ZipLookupFallback {
  readonly name = "null";
  async resolve(): Promise<ZipFallbackResult> {
    return { status: "disabled" };
  }
}

class GeocodioFallback implements ZipLookupFallback {
  readonly name = "geocodio";
  constructor(private readonly apiKey: string) {}

  async resolve(zip: string): Promise<ZipFallbackResult> {
    const url = new URL("https://api.geocod.io/v1.7/geocode");
    url.searchParams.set("q", zip);
    url.searchParams.set("country", "US");
    url.searchParams.set("fields", "stateleg,school");
    url.searchParams.set("api_key", this.apiKey);

    try {
      const res = await fetch(url.toString(), {
        method: "GET",
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) {
        return { status: "error", provider: this.name, reason: `http_${res.status}` };
      }
      const json = (await res.json()) as {
        results?: Array<{
          address_components?: { state?: string; county?: string };
          fields?: { county?: { fips?: string } };
        }>;
      };
      const first = json.results?.[0];
      const state = first?.address_components?.state;
      if (!state) {
        return { status: "miss", provider: this.name };
      }
      return {
        status: "ok",
        provider: this.name,
        location: {
          zip,
          state,
          county: first?.address_components?.county,
          countyFips: first?.fields?.county?.fips,
        },
      };
    } catch (err) {
      return {
        status: "error",
        provider: this.name,
        reason: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

let _instance: ZipLookupFallback | null = null;

export function getZipLookupFallback(): ZipLookupFallback {
  if (_instance) return _instance;
  const provider = (process.env.ZIP_LOOKUP_FALLBACK_PROVIDER ?? "").toLowerCase();
  switch (provider) {
    case "geocodio": {
      const key = process.env.GEOCODIO_API_KEY;
      if (!key) {
        _instance = new NullFallback();
        return _instance;
      }
      _instance = new GeocodioFallback(key);
      return _instance;
    }
    default:
      _instance = new NullFallback();
      return _instance;
  }
}

/** Test seam — reset the cached singleton between tests. */
export function __resetZipLookupFallback(): void {
  _instance = null;
}
