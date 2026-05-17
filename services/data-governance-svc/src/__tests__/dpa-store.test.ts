import { describe, expect, it } from "vitest";
import { InMemoryDpaStore } from "../services/dpa-store.js";

describe("InMemoryDpaStore", () => {
  it("records actor, role, version, and district", () => {
    const store = new InMemoryDpaStore();
    const record = store.acceptDpa({
      districtId: "d1",
      version: "v1.0",
      acceptedById: "u1",
      acceptedByName: "Admin One",
      acceptedByRole: "district_admin",
    });
    expect(record.districtId).toBe("d1");
    expect(record.version).toBe("v1.0");
    expect(record.acceptedById).toBe("u1");
    expect(record.acceptedByRole).toBe("district_admin");
    expect(record.acceptedAt).toBeDefined();
  });

  it("returns the latest acceptance for a district", () => {
    const store = new InMemoryDpaStore();
    store.acceptDpa({
      districtId: "d1",
      version: "v1.0",
      acceptedById: "u1",
      acceptedByName: "Admin One",
      acceptedByRole: "district_admin",
    });
    const latest = store.acceptDpa({
      districtId: "d1",
      version: "v2.0",
      acceptedById: "u2",
      acceptedByName: "Admin Two",
      acceptedByRole: "district_admin",
    });
    expect(store.latestForDistrict("d1")?.id).toBe(latest.id);
  });

  it("returns undefined when no DPA exists", () => {
    const store = new InMemoryDpaStore();
    expect(store.latestForDistrict("missing")).toBeUndefined();
  });
});
