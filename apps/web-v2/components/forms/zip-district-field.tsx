"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Zip code → school district auto-lookup (Sprint A — completion plan).
 *
 * Behavior:
 *   - Parent types a 5-digit US zip. After 300ms debounce the field
 *     calls `GET /api/bff/curriculum/lookup?zipCode=…` and renders
 *     the resolved district inline.
 *   - When a zip overlaps multiple districts (real US data) the
 *     alternates dropdown lets the parent pick a different one.
 *   - "Not your district? Search…" opens a free-text search powered
 *     by `GET /api/bff/curriculum/districts/search`.
 *   - All three values (`zipCode`, `districtId`, `districtName`) are
 *     submitted via hidden inputs so server actions / form posts pick
 *     them up without client JS round-trips.
 *   - Field is optional. Submitting without a zip just omits the
 *     district — the server will fall back to country defaults.
 */

type ResolvedDistrict = {
  ncesId: string;
  name: string;
  state: string;
  city?: string | null;
  weight: number;
  dominant: boolean;
};

type LookupResponse = {
  ok: true;
  data: {
    curriculum: { state?: string; districtId?: string; districtName?: string };
    districts: {
      zip: string;
      dominant: ResolvedDistrict | null;
      alternates: ResolvedDistrict[];
      source: "db" | "miss";
    } | null;
  };
  requestId: string;
};

type SearchResponse = {
  ok: true;
  data: { matches: ResolvedDistrict[] };
  requestId: string;
};

type Status = "idle" | "loading" | "resolved" | "no_match" | "error";

interface ZipDistrictFieldProps {
  /** HTML name for the zip input + the `<input type=hidden>` value posted. */
  zipName?: string;
  /** Hidden field names for the resolved district. */
  districtIdName?: string;
  districtNameName?: string;
  /** Initial values (e.g. when editing an existing learner). */
  defaultZip?: string;
  defaultDistrictId?: string;
  defaultDistrictName?: string;
  label?: string;
  helperText?: string;
}

const DEBOUNCE_MS = 300;
const ZIP_REGEX = /^\d{5}$/;

export function ZipDistrictField({
  zipName = "zipCode",
  districtIdName = "districtId",
  districtNameName = "districtName",
  defaultZip = "",
  defaultDistrictId = "",
  defaultDistrictName = "",
  label = "Zip code",
  helperText = "We use this to align lessons with your local district's standards.",
}: ZipDistrictFieldProps) {
  const [zip, setZip] = React.useState(defaultZip);
  const [status, setStatus] = React.useState<Status>(defaultDistrictId ? "resolved" : "idle");
  const [districtId, setDistrictId] = React.useState(defaultDistrictId);
  const [districtName, setDistrictName] = React.useState(defaultDistrictName);
  const [districtState, setDistrictState] = React.useState<string>("");
  const [alternates, setAlternates] = React.useState<ResolvedDistrict[]>([]);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<ResolvedDistrict[]>([]);
  const [searching, setSearching] = React.useState(false);

  const lookupAbortRef = React.useRef<AbortController | null>(null);
  const searchAbortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    if (!ZIP_REGEX.test(zip)) {
      if (zip.length === 0) setStatus("idle");
      return;
    }

    const timer = setTimeout(async () => {
      lookupAbortRef.current?.abort();
      const ctrl = new AbortController();
      lookupAbortRef.current = ctrl;
      setStatus("loading");

      try {
        const res = await fetch(`/api/bff/curriculum/lookup?zipCode=${encodeURIComponent(zip)}`, {
          signal: ctrl.signal,
        });
        const json = (await res.json()) as LookupResponse;
        if (!json.ok) {
          setStatus("error");
          return;
        }
        const dominant = json.data.districts?.dominant ?? null;
        if (dominant) {
          setDistrictId(dominant.ncesId);
          setDistrictName(dominant.name);
          setDistrictState(dominant.state);
          setAlternates(json.data.districts?.alternates ?? []);
          setStatus("resolved");
        } else if (json.data.curriculum.districtId) {
          // Legacy static-map fallback resolved a major district.
          setDistrictId(json.data.curriculum.districtId);
          setDistrictName(json.data.curriculum.districtName ?? "");
          setDistrictState(json.data.curriculum.state ?? "");
          setAlternates([]);
          setStatus("resolved");
        } else {
          setDistrictId("");
          setDistrictName("");
          setDistrictState(json.data.curriculum.state ?? "");
          setAlternates([]);
          setStatus("no_match");
        }
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        setStatus("error");
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [zip]);

  // District search (manual override).
  React.useEffect(() => {
    if (!searchOpen || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      searchAbortRef.current?.abort();
      const ctrl = new AbortController();
      searchAbortRef.current = ctrl;
      setSearching(true);
      try {
        const params = new URLSearchParams({ q: searchQuery.trim() });
        if (districtState) params.set("state", districtState);
        const res = await fetch(`/api/bff/curriculum/districts/search?${params.toString()}`, {
          signal: ctrl.signal,
        });
        const json = (await res.json()) as SearchResponse;
        if (json.ok) setSearchResults(json.data.matches);
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
      } finally {
        setSearching(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchOpen, searchQuery, districtState]);

  function pickDistrict(d: ResolvedDistrict) {
    setDistrictId(d.ncesId);
    setDistrictName(d.name);
    setDistrictState(d.state);
    setStatus("resolved");
    setSearchOpen(false);
    setSearchQuery("");
  }

  const liveMessage = describeStatus(status, districtName);

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="zipCode" optional>
        {label}
      </Label>
      <Input
        id="zipCode"
        name={zipName}
        type="text"
        inputMode="numeric"
        pattern="\d{5}"
        maxLength={5}
        autoComplete="postal-code"
        value={zip}
        onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
        aria-describedby="zipCode-help zipCode-status"
        placeholder="e.g. 90210"
      />
      <p id="zipCode-help" className="text-xs text-iw-ink-muted">
        {helperText}
      </p>

      <div id="zipCode-status" role="status" aria-live="polite" className="text-sm">
        {status === "loading" && (
          <span className="text-iw-ink-muted">Looking up your district…</span>
        )}
        {status === "resolved" && (
          <span className="text-iw-ink">
            <strong className="font-semibold">{districtName}</strong>
            {districtState ? `, ${districtState}` : ""}
          </span>
        )}
        {status === "no_match" && (
          <span className="text-iw-ink-muted">
            We couldn't find a district for that zip. You can search manually below.
          </span>
        )}
        {status === "error" && (
          <span className="text-iw-warn">
            District lookup is unavailable right now. You can continue without one or search
            manually.
          </span>
        )}
      </div>

      {alternates.length > 0 && status === "resolved" && (
        <div className="flex flex-col gap-1">
          <label htmlFor="district-alternates" className="text-xs text-iw-ink-muted">
            Other districts that cover this zip
          </label>
          <select
            id="district-alternates"
            className="h-9 rounded-iw-control border border-iw-border bg-iw-raised px-2 text-sm text-iw-ink"
            value={districtId}
            onChange={(e) => {
              const next = [
                ...alternates,
                {
                  ncesId: districtId,
                  name: districtName,
                  state: districtState,
                  weight: 1,
                  dominant: true,
                } as ResolvedDistrict,
              ].find((d) => d.ncesId === e.target.value);
              if (next) pickDistrict(next);
            }}
          >
            <option value={districtId}>{districtName} (best match)</option>
            {alternates.map((alt) => (
              <option key={alt.ncesId} value={alt.ncesId}>
                {alt.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <button
        type="button"
        onClick={() => setSearchOpen((v) => !v)}
        className="self-start text-sm text-iw-link underline-offset-2 hover:underline"
      >
        {searchOpen ? "Close search" : "Not your district? Search…"}
      </button>

      {searchOpen && (
        <div className="flex flex-col gap-2 rounded-iw-control border border-iw-border bg-iw-raised p-3">
          <Input
            id="districtSearch"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="District name (e.g. Beverly Hills Unified)"
            aria-label="Search districts by name"
          />
          {searching && <p className="text-xs text-iw-ink-muted">Searching…</p>}
          {!searching && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
            <p className="text-xs text-iw-ink-muted">No matches.</p>
          )}
          {searchResults.length > 0 && (
            <ul className="flex flex-col gap-1" role="listbox" aria-label="District matches">
              {searchResults.map((d) => (
                <li key={d.ncesId}>
                  <button
                    type="button"
                    onClick={() => pickDistrict(d)}
                    className="flex w-full flex-col items-start rounded-iw-control px-2 py-1 text-left text-sm hover:bg-iw-hover"
                  >
                    <span className="font-medium text-iw-ink">{d.name}</span>
                    <span className="text-xs text-iw-ink-muted">
                      {d.city ? `${d.city}, ` : ""}
                      {d.state}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <input type="hidden" name={districtIdName} value={districtId} />
      <input type="hidden" name={districtNameName} value={districtName} />
      <span className="sr-only" aria-live="polite">
        {liveMessage}
      </span>
    </div>
  );
}

function describeStatus(status: Status, name: string): string {
  switch (status) {
    case "loading":
      return "Looking up district.";
    case "resolved":
      return name ? `District resolved: ${name}.` : "";
    case "no_match":
      return "No district matched. Use search to pick one manually.";
    case "error":
      return "District lookup failed. You can continue without one.";
    default:
      return "";
  }
}
