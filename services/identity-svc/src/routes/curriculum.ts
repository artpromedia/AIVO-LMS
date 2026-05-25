import { FastifyInstance } from "fastify";
import { lookupCurriculumAsync } from "../services/curriculum-lookup.js";
import {
  resolveZipToDistricts,
  searchDistricts,
} from "../services/zip-district-resolver.js";

export async function registerCurriculumRoutes(app: FastifyInstance) {
  app.get(
    "/api/curriculum/lookup",
    {
      schema: {
        tags: ["Curriculum"],
        querystring: {
          type: "object",
          properties: {
            zipCode: { type: "string" },
            country: { type: "string" },
          },
        },
      },
    },
    async (req) => {
      const { zipCode, country } = req.query as { zipCode?: string; country?: string };
      return lookupCurriculumAsync({ zipCode, country });
    },
  );

  /**
   * Zip → district disambiguation list. Returns the dominant match
   * plus any alternate districts that overlap the zip (multi-LEA
   * coverage is common in real US data). UI uses the dominant for
   * the auto-fill and the alternates for the "Not your district?"
   * picker.
   */
  app.get(
    "/api/curriculum/districts/by-zip",
    {
      schema: {
        tags: ["Curriculum"],
        querystring: {
          type: "object",
          required: ["zipCode"],
          properties: { zipCode: { type: "string" } },
        },
      },
    },
    async (req, reply) => {
      const { zipCode } = req.query as { zipCode: string };
      const result = await resolveZipToDistricts(zipCode);
      if (!result.dominant && result.alternates.length === 0) {
        return reply.code(404).send({ error: "no_match", zip: result.zip });
      }
      return result;
    },
  );

  /**
   * Free-text district search for the manual override UI. Optional
   * state filter narrows results when the parent's zip resolves to a
   * known state but the wrong district.
   */
  app.get(
    "/api/curriculum/districts/search",
    {
      schema: {
        tags: ["Curriculum"],
        querystring: {
          type: "object",
          required: ["q"],
          properties: {
            q: { type: "string", minLength: 2 },
            state: { type: "string", minLength: 2, maxLength: 2 },
          },
        },
      },
    },
    async (req) => {
      const { q, state } = req.query as { q: string; state?: string };
      const matches = await searchDistricts(q, state);
      return { matches };
    },
  );
}
