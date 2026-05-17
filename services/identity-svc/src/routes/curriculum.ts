import { FastifyInstance } from "fastify";
import { lookupCurriculum } from "../services/curriculum-lookup.js";

export async function registerCurriculumRoutes(app: FastifyInstance) {
  app.get("/api/curriculum/lookup", {
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
  }, async (req) => {
    const { zipCode, country } = req.query as { zipCode?: string; country?: string };
    return lookupCurriculum({ zipCode, country });
  });
}
