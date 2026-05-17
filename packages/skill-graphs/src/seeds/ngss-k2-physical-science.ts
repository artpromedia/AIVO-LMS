import type { SkillGraph } from "../types.js";

/**
 * Next Generation Science Standards — Physical Science, K–2 band.
 * Source: https://www.nextgenscience.org/ (released 2013, available under
 * NGSS terms of use).
 *
 * Performance expectations (PEs) are the canonical NGSS unit. We model each
 * PE as one skill and express the K-2 progression with prerequisites.
 */
export const ngssK2PhysicalScience: SkillGraph = {
  id: "ngss-k2-physical-science",
  title: "Physical Science — Grades K–2 (NGSS-aligned)",
  version: "1.0.0",
  source: "Next Generation Science Standards, Grades K–2 Physical Science (2013)",
  framework: "NGSS",
  subject: "science",
  gradeBand: "K",
  skills: [
    // Kindergarten — Forces and Interactions: Pushes and Pulls
    {
      id: "ngss.K-PS2-1",
      title: "Plan investigations of pushes and pulls",
      description: "I can plan a way to test how strong or weak a push or pull changes the way an object moves.",
      subject: "science",
      gradeBand: "K",
      frameworkRefs: [
        {
          framework: "NGSS",
          code: "K-PS2-1",
          label: "Plan and conduct an investigation to compare the effects of different strengths or different directions of pushes and pulls on the motion of an object.",
        },
      ],
      prerequisites: [],
    },
    {
      id: "ngss.K-PS2-2",
      title: "Use forces to change an object's motion",
      description: "I can use a push or a pull to make an object go in a different direction.",
      subject: "science",
      gradeBand: "K",
      frameworkRefs: [
        {
          framework: "NGSS",
          code: "K-PS2-2",
          label: "Analyze data to determine if a design solution works as intended to change the speed or direction of an object with a push or pull.",
        },
      ],
      prerequisites: ["ngss.K-PS2-1"],
    },

    // Kindergarten — Energy
    {
      id: "ngss.K-PS3-1",
      title: "Observe sunlight's warming effect",
      description: "I can show how sunlight makes things on Earth warmer.",
      subject: "science",
      gradeBand: "K",
      frameworkRefs: [
        {
          framework: "NGSS",
          code: "K-PS3-1",
          label: "Make observations to determine the effect of sunlight on Earth's surface.",
        },
      ],
      prerequisites: [],
    },
    {
      id: "ngss.K-PS3-2",
      title: "Reduce sunlight warming with shade",
      description: "I can build a structure that keeps a spot cool by blocking sunlight.",
      subject: "science",
      gradeBand: "K",
      frameworkRefs: [
        {
          framework: "NGSS",
          code: "K-PS3-2",
          label: "Use tools and materials to design and build a structure that will reduce the warming effect of sunlight on an area.",
        },
      ],
      prerequisites: ["ngss.K-PS3-1"],
    },

    // Grade 1 — Waves: Light and Sound
    {
      id: "ngss.1-PS4-1",
      title: "Vibrations make sound",
      description: "I can show that things that make sound shake (vibrate), and that sound can make things shake.",
      subject: "science",
      gradeBand: "1",
      frameworkRefs: [
        {
          framework: "NGSS",
          code: "1-PS4-1",
          label: "Plan and conduct investigations to provide evidence that vibrating materials can make sound and that sound can make materials vibrate.",
        },
      ],
      prerequisites: [],
    },
    {
      id: "ngss.1-PS4-2",
      title: "Light is needed to see objects",
      description: "I can show that we can only see things when light shines on them.",
      subject: "science",
      gradeBand: "1",
      frameworkRefs: [
        {
          framework: "NGSS",
          code: "1-PS4-2",
          label: "Make observations to construct an evidence-based account that objects can be seen only when illuminated.",
        },
      ],
      prerequisites: [],
    },
    {
      id: "ngss.1-PS4-3",
      title: "Light passes through, around, or off materials",
      description: "I can compare what happens when light meets clear, solid, or shiny things.",
      subject: "science",
      gradeBand: "1",
      frameworkRefs: [
        {
          framework: "NGSS",
          code: "1-PS4-3",
          label: "Plan and conduct investigations to determine the effect of placing objects made with different materials in the path of a beam of light.",
        },
      ],
      prerequisites: ["ngss.1-PS4-2"],
    },
    {
      id: "ngss.1-PS4-4",
      title: "Communicate over a distance with light or sound",
      description: "I can design a way to send a message to a friend using light or sound.",
      subject: "science",
      gradeBand: "1",
      frameworkRefs: [
        {
          framework: "NGSS",
          code: "1-PS4-4",
          label: "Use tools and materials to design and build a device that uses light or sound to solve the problem of communicating over a distance.",
        },
      ],
      prerequisites: ["ngss.1-PS4-1", "ngss.1-PS4-2"],
    },

    // Grade 2 — Matter and Its Interactions
    {
      id: "ngss.2-PS1-1",
      title: "Describe and classify materials by properties",
      description: "I can describe and group materials by how they look and feel.",
      subject: "science",
      gradeBand: "2",
      frameworkRefs: [
        {
          framework: "NGSS",
          code: "2-PS1-1",
          label: "Plan and conduct an investigation to describe and classify different kinds of materials by their observable properties.",
        },
      ],
      prerequisites: [],
    },
    {
      id: "ngss.2-PS1-2",
      title: "Pick the right material for a job",
      description: "I can use what I know about materials to choose the best one for a task.",
      subject: "science",
      gradeBand: "2",
      frameworkRefs: [
        {
          framework: "NGSS",
          code: "2-PS1-2",
          label: "Analyze data obtained from testing different materials to determine which materials have the properties that are best suited for an intended purpose.",
        },
      ],
      prerequisites: ["ngss.2-PS1-1"],
    },
    {
      id: "ngss.2-PS1-3",
      title: "Take small pieces and build something new",
      description: "I can show that a small set of pieces can be put together to make many different things.",
      subject: "science",
      gradeBand: "2",
      frameworkRefs: [
        {
          framework: "NGSS",
          code: "2-PS1-3",
          label: "Make observations to construct an evidence-based account of how an object made of a small set of pieces can be disassembled and made into a new object.",
        },
      ],
      prerequisites: ["ngss.2-PS1-1"],
    },
    {
      id: "ngss.2-PS1-4",
      title: "Reversible vs. irreversible change",
      description: "I can show whether heating or cooling a material can be undone or not.",
      subject: "science",
      gradeBand: "2",
      frameworkRefs: [
        {
          framework: "NGSS",
          code: "2-PS1-4",
          label: "Construct an argument with evidence that some changes caused by heating or cooling can be reversed and some cannot.",
        },
      ],
      prerequisites: ["ngss.2-PS1-1"],
    },
  ],
};
