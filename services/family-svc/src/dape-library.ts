/**
 * DAPE (Adapted Physical Education) Movement Library
 *
 * Curated list of clinically-grounded movement activities covering the
 * eight DAPE skill categories. Each activity includes a visual model
 * (emoji picture sequence), a step list, and tags for sensory/motor
 * targeting and functioning-level adaptations.
 *
 * v1 uses emoji picture sequences as the universal visual model so the
 * library works at every functioning level (incl. picture-only modes).
 * Image/GIF assets can be layered in later via `imageUrl` without changing
 * the schema.
 */

// Goal-detection helpers (isDapeGoal, categoriseDapeGoal, splitDomain,
// DAPE_CATEGORY_LABELS, DapeCategory) are owned by @aivo/scoring so other
// services can reuse them without dragging in the activity catalog. The
// activity library + functioning-tier adaptations stay here because they
// are family-svc-specific UI content.
import {
  type DapeCategory,
  DAPE_CATEGORY_LABELS,
  splitDomain,
  isDapeGoal,
  categoriseDapeGoal,
} from "@aivo/scoring";

export { DAPE_CATEGORY_LABELS, splitDomain, isDapeGoal, categoriseDapeGoal };
export type { DapeCategory };

export type SensoryProfileType = "seeker" | "avoider" | "any";

export type DapeFunctioningTier = "STANDARD" | "SUPPORTED" | "LOW_VERBAL" | "NON_VERBAL" | "PRE_SYMBOLIC";

export interface DapeActivity {
  id: string;
  name: string;
  category: DapeCategory;
  /** Whom this activity helps regulate when used as a break. */
  regulationFor: SensoryProfileType;
  /** Estimated duration in minutes (1-10). */
  durationMin: number;
  /** Picture sequence — 3 to 6 emojis modelling the movement. */
  pictureSequence: string[];
  /** Step-by-step instructions safe for parent/partner to read aloud. */
  steps: string[];
  /** Equipment needed; empty array = no equipment. */
  equipment: string[];
  /** Functioning-level guidance (one note per tier). */
  adaptations: Partial<Record<DapeFunctioningTier, string>>;
  /** Coaching cue for parent/partner. */
  partnerCue: string;
  /** Optional image url (curated stock GIF) — layered in later. */
  imageUrl?: string;
}

export const DAPE_LIBRARY: DapeActivity[] = [
  // ── Locomotor ──────────────────────────────────────────────────────────
  {
    id: "loco-bunny-hops",
    name: "Bunny hops",
    category: "locomotor",
    regulationFor: "seeker",
    durationMin: 2,
    pictureSequence: ["🧍", "🦵", "🐰", "⬆️", "⬇️", "🎉"],
    steps: [
      "Stand with feet together.",
      "Bend knees and tuck hands by your chin like bunny ears.",
      "Hop forward 5 times — small, soft landings.",
      "Pause and take one big breath.",
      "Hop back to start.",
    ],
    equipment: [],
    adaptations: {
      STANDARD: "Track 10 hops in a row without losing balance.",
      SUPPORTED: "Hold partner's hand for the first 3 hops.",
      LOW_VERBAL: "Show the picture card 🐰⬆️⬇️ and hop together.",
      NON_VERBAL: "Partner-assisted: lift gently under arms during each hop.",
      PRE_SYMBOLIC: "Parent bounces child gently on lap — same up/down rhythm.",
    },
    partnerCue: "Count out loud — rhythm helps motor planning.",
  },
  {
    id: "loco-gallop",
    name: "Side gallop",
    category: "locomotor",
    regulationFor: "seeker",
    durationMin: 3,
    pictureSequence: ["🧍", "➡️", "🐎", "↔️", "⬅️", "🎉"],
    steps: [
      "Stand sideways. Lead foot steps to the side.",
      "Back foot meets the lead foot — step, together, step.",
      "Gallop 4 steps to the right.",
      "Pause, then gallop 4 steps back to the left.",
    ],
    equipment: [],
    adaptations: {
      STANDARD: "Add arm swings opposite to your steps.",
      SUPPORTED: "Use a line on the floor as a visual track.",
      LOW_VERBAL: "Use 2 picture cards: ➡️ and ⬅️ to signal direction.",
      NON_VERBAL: "Partner stands behind, shifts weight side to side together.",
      PRE_SYMBOLIC: "Sway side-to-side with child in arms to music.",
    },
    partnerCue: "Sing 'step-together-step' to externalise the pattern.",
  },
  // ── Object control ─────────────────────────────────────────────────────
  {
    id: "obj-bean-bag-toss",
    name: "Bean-bag toss",
    category: "object_control",
    regulationFor: "any",
    durationMin: 3,
    pictureSequence: ["🧍", "🫘", "🎯", "🤲", "🎉"],
    steps: [
      "Sit or stand 2 steps from a basket or marked target.",
      "Hold the bean bag with both hands.",
      "Swing arms back, then toss underhand toward the target.",
      "Walk to retrieve. Repeat 5 times.",
    ],
    equipment: ["1 bean bag (or rolled sock)", "basket or floor target"],
    adaptations: {
      STANDARD: "Step back one tile after each successful toss.",
      SUPPORTED: "Use a wider, lower basket. Celebrate every toss.",
      LOW_VERBAL: "Hand-over-hand for first 2 tosses, then fade.",
      NON_VERBAL: "Partner places hand under learner's, releases together.",
      PRE_SYMBOLIC: "Drop bean bag into a bucket together — listen to the thud.",
    },
    partnerCue: "Notice their grip. A two-handed grip is fine — release timing matters more than form.",
  },
  {
    id: "obj-rolling-catch",
    name: "Rolling catch",
    category: "object_control",
    regulationFor: "any",
    durationMin: 4,
    pictureSequence: ["🧍", "⚽", "🤲", "↔️", "🎉"],
    steps: [
      "Sit on the floor facing your partner, legs in a wide V.",
      "Roll a ball back and forth, aiming between their feet.",
      "Stop the ball with both hands like a 'catcher'.",
      "Try 10 successful rolls.",
    ],
    equipment: ["soft ball"],
    adaptations: {
      STANDARD: "Move farther apart each round.",
      SUPPORTED: "Use a bigger, slower ball. Keep distance close.",
      LOW_VERBAL: "Use a picture of the ball to signal whose turn.",
      NON_VERBAL: "Partner rolls the ball into the learner's hands.",
      PRE_SYMBOLIC: "Tactile play — let child feel the ball arrive at their feet.",
    },
    partnerCue: "Eye contact during the roll builds anticipation and motor planning.",
  },
  // ── Balance ────────────────────────────────────────────────────────────
  {
    id: "bal-flamingo",
    name: "Flamingo stand",
    category: "balance",
    regulationFor: "any",
    durationMin: 2,
    pictureSequence: ["🧍", "🦩", "⏱️", "🎉"],
    steps: [
      "Stand near a wall or chair for safety.",
      "Lift one foot just off the floor.",
      "Hold for 5 seconds. Switch feet.",
      "Repeat 3 times each side.",
    ],
    equipment: [],
    adaptations: {
      STANDARD: "Hold for 15 seconds without touching the wall.",
      SUPPORTED: "Use one finger on the wall for support.",
      LOW_VERBAL: "Use a visual timer — count down together.",
      NON_VERBAL: "Partner holds learner's hands; shift weight onto one foot.",
      PRE_SYMBOLIC: "Practice weight-shifting in seated rocking.",
    },
    partnerCue: "Gaze at a fixed point ahead — it stabilises balance.",
  },
  {
    id: "bal-line-walk",
    name: "Line walk",
    category: "balance",
    regulationFor: "any",
    durationMin: 3,
    pictureSequence: ["📏", "🧍", "👣", "👣", "👣", "🎉"],
    steps: [
      "Tape or chalk a 2-meter line on the floor.",
      "Walk heel-to-toe along the line, arms out for balance.",
      "Turn carefully and walk back.",
      "Try 3 trips.",
    ],
    equipment: ["tape or chalk for a line"],
    adaptations: {
      STANDARD: "Eyes closed for the last trip (with a partner spotting).",
      SUPPORTED: "Use a wider line and walk normally first.",
      LOW_VERBAL: "Show footprint stickers along the line.",
      NON_VERBAL: "Partner-assisted: hands on hips, walk together.",
      PRE_SYMBOLIC: "Roll a ball along the line and watch it.",
    },
    partnerCue: "Slow and steady beats fast and wobbly.",
  },
  // ── Midline crossing ───────────────────────────────────────────────────
  {
    id: "mid-cross-crawl",
    name: "Cross-crawl",
    category: "midline_crossing",
    regulationFor: "any",
    durationMin: 2,
    pictureSequence: ["🧍", "🤚", "🦵", "🔄", "🎉"],
    steps: [
      "Stand tall, arms by your sides.",
      "Lift right knee, touch it with your LEFT hand.",
      "Lower, then lift left knee, touch with RIGHT hand.",
      "Continue slowly for 30 seconds.",
    ],
    equipment: [],
    adaptations: {
      STANDARD: "Speed up after 30 seconds. Keep the cross pattern.",
      SUPPORTED: "Sit in a chair and cross-touch from seated.",
      LOW_VERBAL: "Mirror the partner — copy their movement.",
      NON_VERBAL: "Partner-assisted: gently guide hand to opposite knee.",
      PRE_SYMBOLIC: "Crossed-leg gentle rocking together.",
    },
    partnerCue: "Crossing the midline activates both brain hemispheres — pause if it feels effortful.",
  },
  {
    id: "mid-figure-8",
    name: "Figure-8 tracing",
    category: "midline_crossing",
    regulationFor: "any",
    durationMin: 3,
    pictureSequence: ["✋", "♾️", "👀", "🎉"],
    steps: [
      "Hold a finger or marker out in front of you.",
      "Trace a large figure-8 in the air, eyes following the finger.",
      "Trace 5 times one direction, 5 times the other.",
    ],
    equipment: [],
    adaptations: {
      STANDARD: "Trace with non-dominant hand for the second set.",
      SUPPORTED: "Use a brightly coloured object to track.",
      LOW_VERBAL: "Use a sticker on a stick — bright visual target.",
      NON_VERBAL: "Partner moves the target while learner watches.",
      PRE_SYMBOLIC: "Slowly move a soft light across the field of vision.",
    },
    partnerCue: "Eye-tracking and midline-crossing in one — great handwriting prep.",
  },
  // ── Heavy work / proprioceptive ────────────────────────────────────────
  {
    id: "heavy-wall-pushes",
    name: "Wall pushes",
    category: "heavy_work",
    regulationFor: "seeker",
    durationMin: 2,
    pictureSequence: ["🧍", "🧱", "💪", "🔁", "🎉"],
    steps: [
      "Stand arm's length from a sturdy wall.",
      "Place flat palms on the wall, shoulder-width apart.",
      "Lean in and push the wall hard for a slow count of 5.",
      "Rest. Repeat 5 times.",
    ],
    equipment: ["a sturdy wall"],
    adaptations: {
      STANDARD: "Move feet farther back for more challenge.",
      SUPPORTED: "Push from a kneeling position.",
      LOW_VERBAL: "Use a picture of a wall + 5 finger countdown.",
      NON_VERBAL: "Partner adds firm pressure on shoulders during push.",
      PRE_SYMBOLIC: "Deep pressure squeezes on shoulders and arms.",
    },
    partnerCue: "Heavy work calms most seekers within 2-3 minutes.",
  },
  {
    id: "heavy-bear-walk",
    name: "Bear walk",
    category: "heavy_work",
    regulationFor: "seeker",
    durationMin: 3,
    pictureSequence: ["🧎", "🐻", "🤲", "🦶", "🎉"],
    steps: [
      "Start on hands and feet, hips up like a bear.",
      "Move right hand and left foot together.",
      "Then left hand and right foot.",
      "Walk 5 paces forward, then 5 back.",
    ],
    equipment: [],
    adaptations: {
      STANDARD: "Bear-walk along a longer course or up a small slope.",
      SUPPORTED: "Walk on hands and knees instead.",
      LOW_VERBAL: "Show a bear picture and demonstrate one cycle.",
      NON_VERBAL: "Partner-assisted: support hips, move slowly.",
      PRE_SYMBOLIC: "Floor play with hands-and-feet exploration.",
    },
    partnerCue: "Loads joints in a regulating, organising way.",
  },
  // ── Vestibular ─────────────────────────────────────────────────────────
  {
    id: "vest-slow-spin",
    name: "Slow spin",
    category: "vestibular",
    regulationFor: "avoider",
    durationMin: 2,
    pictureSequence: ["🧍", "🔄", "⏱️", "🛑", "🎉"],
    steps: [
      "Stand in an open space, arms out for balance.",
      "Turn slowly in one direction — 1 full circle.",
      "Pause for 5 seconds.",
      "Turn slowly the other way — 1 full circle.",
    ],
    equipment: [],
    adaptations: {
      STANDARD: "2 full circles each direction.",
      SUPPORTED: "Hold partner's hand throughout.",
      LOW_VERBAL: "Sit on a swivel chair and turn together.",
      NON_VERBAL: "Partner gently rotates a swivel chair.",
      PRE_SYMBOLIC: "Slow rocking in a parent's arms.",
    },
    partnerCue: "Stop immediately if learner looks dizzy or overwhelmed.",
  },
  {
    id: "vest-rocking-boat",
    name: "Rocking boat",
    category: "vestibular",
    regulationFor: "avoider",
    durationMin: 3,
    pictureSequence: ["🧎", "🚤", "↔️", "🎉"],
    steps: [
      "Sit cross-legged with hands on knees.",
      "Rock gently side to side, 10 times.",
      "Then rock front to back, 10 times.",
      "Finish with 3 deep breaths.",
    ],
    equipment: [],
    adaptations: {
      STANDARD: "Add slow shoulder rolls between sets.",
      SUPPORTED: "Rock seated in a chair instead.",
      LOW_VERBAL: "Use a metronome or steady drumbeat.",
      NON_VERBAL: "Partner sits behind, rocks together.",
      PRE_SYMBOLIC: "Lap rocking with eye contact.",
    },
    partnerCue: "Slow, predictable vestibular input is calming for most avoiders.",
  },
  // ── Fine motor ─────────────────────────────────────────────────────────
  {
    id: "fine-pinch-pop",
    name: "Pinch-pop bubble wrap",
    category: "fine_motor",
    regulationFor: "any",
    durationMin: 3,
    pictureSequence: ["✋", "🫧", "👌", "💥", "🎉"],
    steps: [
      "Hold the bubble wrap between thumb and index finger.",
      "Pinch firmly to pop one bubble.",
      "Switch to thumb + middle finger. Pop again.",
      "Try thumb + ring finger and thumb + pinky.",
    ],
    equipment: ["small piece of bubble wrap"],
    adaptations: {
      STANDARD: "Pop a row of 10 using each finger pair.",
      SUPPORTED: "Use larger bubbles. Demonstrate first.",
      LOW_VERBAL: "Show finger-pair pictures.",
      NON_VERBAL: "Partner guides finger-thumb pinch.",
      PRE_SYMBOLIC: "Squeeze sensory toys for tactile-motor input.",
    },
    partnerCue: "Building each finger-thumb opposition strengthens pencil grip.",
  },
  {
    id: "fine-tweezer-transfer",
    name: "Tweezer transfer",
    category: "fine_motor",
    regulationFor: "any",
    durationMin: 4,
    pictureSequence: ["🤏", "🫘", "↔️", "🥣", "🎉"],
    steps: [
      "Place 10 small objects (pom-poms, dry beans) in one bowl.",
      "Use child-safe tweezers to move them, one by one, into a second bowl.",
      "Try with the other hand.",
    ],
    equipment: ["child-safe tweezers", "2 small bowls", "small objects"],
    adaptations: {
      STANDARD: "Sort by colour as you transfer.",
      SUPPORTED: "Use larger objects, like cotton balls.",
      LOW_VERBAL: "Picture model: tweezers + bowl arrow + bowl.",
      NON_VERBAL: "Partner-assisted: hand-over-hand at first.",
      PRE_SYMBOLIC: "Scoop and pour with hands instead.",
    },
    partnerCue: "Tweezers train tripod grasp — the same muscles used for pencil control.",
  },
  // ── Handwriting prep ───────────────────────────────────────────────────
  {
    id: "hw-air-letters",
    name: "Air letters",
    category: "handwriting_prep",
    regulationFor: "any",
    durationMin: 3,
    pictureSequence: ["✋", "🅰️", "👀", "🎉"],
    steps: [
      "Pick a letter your partner names.",
      "Write the letter big in the air with one finger, eyes following.",
      "Now smaller, on your palm.",
      "Now smallest, on a piece of paper.",
    ],
    equipment: ["paper, pencil (optional)"],
    adaptations: {
      STANDARD: "Try lowercase, then a 3-letter word.",
      SUPPORTED: "Trace a printed model first.",
      LOW_VERBAL: "Use a single letter card and copy together.",
      NON_VERBAL: "Partner traces letter on learner's palm.",
      PRE_SYMBOLIC: "Trace circles and zig-zags in shaving cream.",
    },
    partnerCue: "Big-to-small progression strengthens motor memory for letters.",
  },
  {
    id: "hw-wet-dry-try",
    name: "Wet-dry-try",
    category: "handwriting_prep",
    regulationFor: "any",
    durationMin: 4,
    pictureSequence: ["💧", "🧽", "✏️", "🎉"],
    steps: [
      "Adult writes a letter on a small chalkboard.",
      "Learner traces it with a wet sponge (WET).",
      "Pat it dry with a tissue (DRY).",
      "Now write the letter with chalk on a fresh space (TRY).",
    ],
    equipment: ["small chalkboard or laminated card", "chalk", "small sponge", "water"],
    adaptations: {
      STANDARD: "Repeat with a 3-letter word.",
      SUPPORTED: "Adult does step 1, learner does WET and DRY only.",
      LOW_VERBAL: "Picture cards for WET / DRY / TRY in order.",
      NON_VERBAL: "Partner-assisted at every step.",
      PRE_SYMBOLIC: "Sensory water play with sponges.",
    },
    partnerCue: "Multi-sensory letter formation is the gold standard for emerging writers.",
  },
];

/** Pick an activity for the given category and functioning level. */
export function pickActivity(
  category: DapeCategory,
  level: DapeFunctioningTier = "STANDARD",
  seed = Date.now(),
): DapeActivity | null {
  const pool = DAPE_LIBRARY.filter((a) => a.category === category);
  if (pool.length === 0) return null;
  const idx = Math.abs(seed) % pool.length;
  const chosen = pool[idx];
  // Filter the adaptations down to the requested level for the API response.
  return {
    ...chosen,
    adaptations: chosen.adaptations[level]
      ? { [level]: chosen.adaptations[level]! }
      : chosen.adaptations,
  };
}

/** Suggest a regulation break activity based on dysregulation profile. */
export function suggestRegulationBreak(profile: SensoryProfileType): DapeActivity {
  const candidates = DAPE_LIBRARY.filter((a) => a.regulationFor === profile || a.regulationFor === "any");
  return candidates[Math.floor(Math.random() * candidates.length)];
}
