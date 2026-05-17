import type { BrainContextSnapshot, FunctioningLevel, Subject } from "./types.js";

export function buildProfileAdaptations(
  subject: Subject,
  brain: BrainContextSnapshot,
  functioningLevel?: FunctioningLevel,
): string[] {
  const adaptations: string[] = [];
  const level = functioningLevel ?? brain.functioningLevel;
  const accommodations = brain.accommodations ?? [];

  if (level === "NON_VERBAL") {
    adaptations.push("No speech-required tasks; provide AAC-friendly choice surfaces.");
  }
  if (level === "LOW_VERBAL" || level === "PRE_SYMBOLIC") {
    adaptations.push("Use short prompts and reduced text density.");
    adaptations.push("Prefer visual surfaces over typed responses.");
  }
  if (level === "DEVELOPING") {
    adaptations.push("Pair narration with visual scaffolds.");
  }
  if (accommodations.includes("reduced_motion")) {
    adaptations.push("Disable non-essential animation.");
  }
  if (accommodations.includes("high_contrast")) {
    adaptations.push("Use high-contrast color palette.");
  }
  if (accommodations.includes("extended_time")) {
    adaptations.push("Remove time pressure from feedback.");
  }
  if (subject === "ela" && (level === "LOW_VERBAL" || level === "PRE_SYMBOLIC")) {
    adaptations.push("Chunk passages and provide annotation supports.");
  }
  if (subject === "world_language") {
    adaptations.push("Provide TTS-ready prompts and cultural context notes.");
  }
  return adaptations;
}
