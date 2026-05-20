/**
 * @aivo/ui/learner-dashboard
 *
 * Primitives for the SensoryAdaptive learner dashboard. These compose
 * the layout shown in the reference design: a workspace rail with
 * profile + sensory controls on the left, a top stat strip, a
 * featured-lesson hero, and an AI-tutor grid.
 *
 * Components:
 *   StatChip               Level / XP / streak stat tile
 *   LearnerLevelBadge      "Level: EMERGING" pill for the stat strip
 *   LearnerProfileCard     Avatar + name + role + approval status
 *   SensoryControlGroup    Segmented selector for Mood/Spacing/etc.
 *   TutorAvatar            Pastel tile with glyph slot
 *   TutorAvatarCard        Tile + name + subject card for the tutor grid
 *   FeaturedLessonCard     "Today's mission" hero card
 *   LessonSecondaryAction  Soft-outlined pill (Read Aloud, Overview)
 */
export * from "./StatChip.js";
export * from "./LearnerLevelBadge.js";
export * from "./LearnerProfileCard.js";
export * from "./SensoryControlGroup.js";
export * from "./TutorAvatar.js";
export * from "./TutorAvatarCard.js";
export * from "./FeaturedLessonCard.js";
