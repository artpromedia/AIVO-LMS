/**
 * @aivo/ui/baseline
 *
 * Calm, child-friendly primitives for the custom baseline assessment
 * experience (sprint 6). These compose on @aivo/ui/surface and follow
 * the same 7-state contract.
 *
 * Components:
 *   Baseline/LearnerBaselineShell   protected full-screen canvas with optional proctor banner
 *   Baseline/AICompanionHero        hero panel with AI orb + chips
 *   Baseline/PersonalizationChip    "personalized from parent assessment" status pill
 *   Baseline/BaselineProgressDots   calm dot-strip progress (no numbers)
 *   Baseline/LearnerQuestionCard    large rounded one-question-at-a-time card
 *   Baseline/LearnerChoiceCard      large touch-friendly answer card
 *   Baseline/ReadAloudButton        toggle for TTS playback
 *   Baseline/HintCard               collapsible hint with teacher policy support
 *   Baseline/BreakCard              calm pause / "take a breath" screen
 *   Baseline/CompletionHero         calm completion without grades
 *   Baseline/ProctorBanner          parent / teacher proctor-mode banner
 */
export * from "./LearnerBaselineShell.js";
export * from "./learner-prefs.js";
export * from "./AICompanionHero.js";
export * from "./PersonalizationChip.js";
export * from "./BaselineProgressDots.js";
export * from "./LearnerQuestionCard.js";
export * from "./LearnerChoiceCard.js";
export * from "./ReadAloudButton.js";
export * from "./HintCard.js";
export * from "./BreakCard.js";
export * from "./CompletionHero.js";
export * from "./ProctorBanner.js";
