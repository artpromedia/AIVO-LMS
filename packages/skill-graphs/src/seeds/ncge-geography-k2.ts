import type { SkillGraph } from "../types.js";

/**
 * National Geography Standards — K–2 starter slice for Atlas.
 * Source: National Council for Geographic Education (NCGE), "Geography
 * for Life: National Geography Standards" (1994, updated 2012).
 *
 * Anchored to the Six Essential Elements; the K–2 progression here
 * covers The World in Spatial Terms (Standards 1–3) and Places & Regions
 * (Standard 4) entry points.
 */
export const ngsGeographyK2: SkillGraph = {
  id: "ncge-geography-k2",
  title: "Geography & World Cultures — Grades K–2 (NCGE-aligned)",
  version: "1.0.0",
  source: "Geography for Life: National Geography Standards (NCGE 2012)",
  framework: "NCGE",
  subject: "geography",
  gradeBand: "K",
  skills: [
    {
      id: "ncge.k2.S1.1",
      title: "Use maps and globes to find places",
      description: "I can use a map or a globe to find where I live and other places.",
      subject: "geography",
      gradeBand: "K",
      frameworkRefs: [{ framework: "NCGE", code: "Standard 1" }],
      prerequisites: [],
    },
    {
      id: "ncge.k2.S2.1",
      title: "Describe my neighborhood with mental maps",
      description: "I can draw a simple map of my home, classroom, or street.",
      subject: "geography",
      gradeBand: "K",
      frameworkRefs: [{ framework: "NCGE", code: "Standard 2" }],
      prerequisites: ["ncge.k2.S1.1"],
    },
    {
      id: "ncge.k2.S3.1",
      title: "Locate continents and oceans",
      description: "I can name and find the seven continents and the oceans on a globe.",
      subject: "geography",
      gradeBand: "K",
      frameworkRefs: [{ framework: "NCGE", code: "Standard 3" }],
      prerequisites: ["ncge.k2.S1.1"],
    },
    {
      id: "ncge.k2.S4.1",
      title: "Describe physical and human features of a place",
      description: "I can tell about mountains, rivers, buildings, and people in a place.",
      subject: "geography",
      gradeBand: "K",
      frameworkRefs: [{ framework: "NCGE", code: "Standard 4" }],
      prerequisites: ["ncge.k2.S2.1"],
    },
    {
      id: "ncge.k2.S10.1",
      title: "Compare cultures around the world",
      description: "I can compare food, clothing, music, or homes from different cultures.",
      subject: "geography",
      gradeBand: "K",
      frameworkRefs: [{ framework: "NCGE", code: "Standard 10" }],
      prerequisites: ["ncge.k2.S3.1", "ncge.k2.S4.1"],
    },
  ],
};
