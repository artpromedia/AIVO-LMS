import type { Item } from "../../services/types.js";

/**
 * 20 SEL items — 5 per CASEL competency.
 *
 * Surfaces: ChoiceGrid (low-stakes selection), VoiceResponse (open
 * reflection), Scratchpad (drawing/free text). Every item is reviewed
 * for tone safety; see services/responsible-ai-svc for the runtime
 * content-safety gate applied at delivery time.
 */
export const SEL_ITEMS: Item[] = [
  // Self-awareness (5)
  {
    id: "SEL.SA.001",
    skillCode: "SEL.SELF_AWARE",
    difficulty: -1.5,
    surface: "choice_grid",
    prompt: "Look at the four faces. Which one feels closest to how you feel right now?",
    options: ["Calm", "Excited", "Worried", "Tired"],
    metadata: { competency: "self-awareness", safetyChecked: true },
  },
  {
    id: "SEL.SA.002",
    skillCode: "SEL.SELF_AWARE",
    difficulty: -0.5,
    surface: "voice_response",
    prompt:
      "Tell me about a time today when your body felt one of those feelings. Where did you feel it?",
    metadata: { competency: "self-awareness", expectedReflectionDepth: 2, safetyChecked: true },
  },
  {
    id: "SEL.SA.003",
    skillCode: "SEL.SELF_AWARE",
    difficulty: 0.0,
    surface: "scratchpad",
    prompt: "Draw your feeling weather: sunny, cloudy, stormy, rainy. There is no wrong answer.",
    metadata: { competency: "self-awareness", safetyChecked: true },
  },
  {
    id: "SEL.SA.004",
    skillCode: "SEL.SELF_AWARE",
    difficulty: -1.0,
    surface: "choice_grid",
    prompt: "Pick a strength of yours.",
    options: ["I notice details", "I help friends", "I keep trying", "I share ideas"],
    metadata: { competency: "self-awareness", safetyChecked: true },
  },
  {
    id: "SEL.SA.005",
    skillCode: "SEL.SELF_AWARE",
    difficulty: 0.5,
    surface: "voice_response",
    prompt: "Name one thing that makes you proud of yourself. It can be small.",
    metadata: { competency: "self-awareness", expectedReflectionDepth: 3, safetyChecked: true },
  },

  // Self-management (5)
  {
    id: "SEL.SM.001",
    skillCode: "SEL.SELF_MANAGE",
    difficulty: -1.0,
    surface: "choice_grid",
    prompt: "When you start feeling frustrated, which one helps you most?",
    options: ["Slow breaths", "Counting to 10", "Asking for a break", "Stretching"],
    metadata: { competency: "self-management", safetyChecked: true },
  },
  {
    id: "SEL.SM.002",
    skillCode: "SEL.SELF_MANAGE",
    difficulty: -0.5,
    surface: "voice_response",
    prompt: "Describe a calming strategy you have used recently. How did it feel?",
    metadata: { competency: "self-management", expectedReflectionDepth: 2, safetyChecked: true },
  },
  {
    id: "SEL.SM.003",
    skillCode: "SEL.SELF_MANAGE",
    difficulty: 0.5,
    surface: "scratchpad",
    prompt: "Draw or write what your calm-down toolbox looks like.",
    metadata: { competency: "self-management", safetyChecked: true },
  },
  {
    id: "SEL.SM.004",
    skillCode: "SEL.SELF_MANAGE",
    difficulty: 0.0,
    surface: "choice_grid",
    prompt: "Which goal feels right-sized for this week?",
    options: ["Try one new thing", "Ask one question", "Help one person", "Notice one feeling"],
    metadata: { competency: "self-management", safetyChecked: true },
  },
  {
    id: "SEL.SM.005",
    skillCode: "SEL.SELF_MANAGE",
    difficulty: 1.0,
    surface: "voice_response",
    prompt: "Tell me about a time you stayed calm when something was hard.",
    metadata: { competency: "self-management", expectedReflectionDepth: 3, safetyChecked: true },
  },

  // Social-awareness (5)
  {
    id: "SEL.SOC.001",
    skillCode: "SEL.SOCIAL_AWARE",
    difficulty: -0.5,
    surface: "choice_grid",
    prompt: "Your friend looks down. What is the kind first step?",
    options: ["Say hi gently", "Sit nearby quietly", "Ask if they're okay", "Offer a smile"],
    metadata: { competency: "social-awareness", safetyChecked: true },
  },
  {
    id: "SEL.SOC.002",
    skillCode: "SEL.SOCIAL_AWARE",
    difficulty: 0.0,
    surface: "voice_response",
    prompt: "What does it feel like when someone listens to you with their whole body?",
    metadata: { competency: "social-awareness", expectedReflectionDepth: 2, safetyChecked: true },
  },
  {
    id: "SEL.SOC.003",
    skillCode: "SEL.SOCIAL_AWARE",
    difficulty: 0.5,
    surface: "voice_response",
    prompt:
      "Think of someone whose life is different from yours. What might a normal Tuesday look like for them?",
    metadata: { competency: "social-awareness", expectedReflectionDepth: 3, safetyChecked: true },
  },
  {
    id: "SEL.SOC.004",
    skillCode: "SEL.SOCIAL_AWARE",
    difficulty: -1.0,
    surface: "choice_grid",
    prompt: "Which of these means showing empathy?",
    options: [
      "Trying to feel what they feel",
      "Telling them to cheer up",
      "Walking away",
      "Solving their problem fast",
    ],
    metadata: { competency: "social-awareness", safetyChecked: true },
  },
  {
    id: "SEL.SOC.005",
    skillCode: "SEL.SOCIAL_AWARE",
    difficulty: 1.0,
    surface: "scratchpad",
    prompt: "Draw two characters showing the same feeling in different ways.",
    metadata: { competency: "social-awareness", safetyChecked: true },
  },

  // Relationship skills (5)
  {
    id: "SEL.REL.001",
    skillCode: "SEL.RELATIONSHIP",
    difficulty: -0.5,
    surface: "choice_grid",
    prompt: "A friend wants the same toy you do. What is a fair next move?",
    options: ["Take turns", "Play together", "Ask a grown-up to help", "Pick a different toy"],
    metadata: { competency: "relationship-skills", safetyChecked: true },
  },
  {
    id: "SEL.REL.002",
    skillCode: "SEL.RELATIONSHIP",
    difficulty: 0.0,
    surface: "voice_response",
    prompt: "Tell about a time you and a friend solved a disagreement.",
    metadata: {
      competency: "relationship-skills",
      expectedReflectionDepth: 2,
      safetyChecked: true,
    },
  },
  {
    id: "SEL.REL.003",
    skillCode: "SEL.RELATIONSHIP",
    difficulty: 0.5,
    surface: "voice_response",
    prompt: "What words help when someone is upset with you?",
    metadata: {
      competency: "relationship-skills",
      expectedReflectionDepth: 3,
      safetyChecked: true,
    },
  },
  {
    id: "SEL.REL.004",
    skillCode: "SEL.RELATIONSHIP",
    difficulty: -1.0,
    surface: "choice_grid",
    prompt: "Which is an I-message?",
    options: [
      "I feel sad when that happens.",
      "You always do that!",
      "You should stop.",
      "It is your fault.",
    ],
    metadata: { competency: "relationship-skills", safetyChecked: true },
  },
  {
    id: "SEL.REL.005",
    skillCode: "SEL.RELATIONSHIP",
    difficulty: 1.0,
    surface: "scratchpad",
    prompt: "Draw a comic of two friends listening and repairing after a small misunderstanding.",
    metadata: { competency: "relationship-skills", safetyChecked: true },
  },
];
