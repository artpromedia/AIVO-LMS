// @vitest-environment jsdom

/**
 * SessionRefresher keeps the short-lived access token warm so token-scoped BFF
 * calls stop 401/403-ing on long-open tabs. These pin its contract: gated by
 * `enabled`, refreshes on mount + on the interval, and stops polling once the
 * refresh endpoint says there's nothing to refresh (401/404).
 */
import * as React from "react";
import { render, cleanup, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionRefresher } from "./session-refresher";

const REFRESH_MS = 10 * 60 * 1000;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("SessionRefresher", () => {
  it("does nothing when disabled (e.g. mock auth or logged out)", async () => {
    render(<SessionRefresher enabled={false} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refreshes on mount and again on each interval", async () => {
    vi.useFakeTimers();
    render(<SessionRefresher enabled />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/bff/auth/refresh",
      expect.objectContaining({ method: "POST" }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(REFRESH_MS);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("stops polling after an unauthorized/unavailable (non-ok) response", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue({ ok: false });
    render(<SessionRefresher enabled />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(REFRESH_MS * 3);
    });
    // Still 1 — the first non-ok response cleared the interval.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps polling through a transient network error", async () => {
    vi.useFakeTimers();
    fetchMock.mockRejectedValueOnce(new Error("network")).mockResolvedValue({ ok: true });
    render(<SessionRefresher enabled />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1); // threw, but did not stop

    await act(async () => {
      await vi.advanceTimersByTimeAsync(REFRESH_MS);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
