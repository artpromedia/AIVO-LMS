import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ADMIN_ROLE_HOME } from "@aivo/admin-auth/types";

const appRoot = fileURLToPath(new URL("./app/", import.meta.url));

describe("canonical admin role homes", () => {
  for (const [role, route] of Object.entries(ADMIN_ROLE_HOME)) {
    it(`${role} resolves to an existing web-admin page`, () => {
      const pagePath = fileURLToPath(new URL(`.${route}/page.tsx`, new URL("./app/", import.meta.url)));
      expect(pagePath.startsWith(appRoot)).toBe(true);
      expect(existsSync(pagePath), `${role} home ${route} must exist in web-admin`).toBe(true);
    });
  }
});
