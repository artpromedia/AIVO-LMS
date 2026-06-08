/**
 * Seat-availability helper — the dev/memory store is never gated.
 *
 * The real per-tenant cap is exercised end-to-end in the district-pilot e2e
 * (Sprint 3) against Postgres; here we pin the invariant that the in-memory
 * development store stays unlimited so local work isn't blocked, and that the
 * helper never throws on the default mode.
 */
import { describe, expect, it } from "vitest";
import { getTenantSeatAvailability } from "./seat-availability";

describe("getTenantSeatAvailability (memory mode)", () => {
  it("returns unlimited/allowed when not on the postgres store", async () => {
    const seats = await getTenantSeatAvailability("t_demo");
    expect(seats.allowed).toBe(true);
    expect(seats.seatLimit).toBeNull();
    expect(seats.remaining).toBeNull();
  });
});
