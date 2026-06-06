import { describe, expect, it } from "vitest";
import { ADMIN_ROLE_HOME } from "@aivo/admin-auth/types";
import { ROLE_HOME } from "./types";

describe("standalone admin role homes", () => {
  for (const [role, route] of Object.entries(ADMIN_ROLE_HOME)) {
    it(`${role} leaves web-v2 for its canonical standalone route`, () => {
      const home = new URL(ROLE_HOME[role as keyof typeof ADMIN_ROLE_HOME]);
      expect(home.pathname).toBe(route);
      expect(home.hostname).toBe(role === "district_admin" ? "district.aivolearning.com" : "admin.aivolearning.com");
    });
  }
});
