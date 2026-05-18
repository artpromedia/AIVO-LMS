/**
 * Canonical Quest World registry for engagement-svc.
 *
 * Single source of truth used by every quest route. The web client never
 * duplicates this data — it resolves worlds through the API only. Aliases
 * exist so deep links can use either the world key (`nova_number_galaxy`)
 * or the tutor key (`nova`) and reach the same surface.
 */

export interface QuestWorld {
  key: string;
  name: string;
  tutorKey: string;
  subject: string;
  description: string;
  chapters: number;
}

export const QUEST_WORLDS: readonly QuestWorld[] = [
  {
    key: "nova_number_galaxy",
    name: "Nova's Number Galaxy",
    tutorKey: "nova",
    subject: "Mathematics",
    description: "Explore the cosmos of numbers with Nova!",
    chapters: 5,
  },
  {
    key: "sage_story_kingdom",
    name: "Sage's Story Kingdom",
    tutorKey: "sage",
    subject: "English Language Arts",
    description: "Journey through the kingdom of stories with Sage!",
    chapters: 5,
  },
  {
    key: "spark_science_lab",
    name: "Spark's Science Lab",
    tutorKey: "spark",
    subject: "Science",
    description: "Discover the wonders of science with Spark!",
    chapters: 5,
  },
  {
    key: "chrono_time_tower",
    name: "Chrono's Time Tower",
    tutorKey: "chrono",
    subject: "History",
    description: "Travel through time with Chrono!",
    chapters: 5,
  },
  {
    key: "pixel_code_forge",
    name: "Pixel's Code Forge",
    tutorKey: "pixel",
    subject: "Coding & Computer Science",
    description: "Build amazing things with Pixel!",
    chapters: 5,
  },
];

export const QUEST_WORLD_ALIASES: Readonly<Record<string, string>> = Object.freeze(
  QUEST_WORLDS.reduce<Record<string, string>>((acc, world) => {
    acc[world.key] = world.key;
    acc[world.tutorKey] = world.key;
    return acc;
  }, {}),
);

export function resolveQuestWorld(slugOrKey: string | undefined | null): QuestWorld | undefined {
  if (!slugOrKey) return undefined;
  const canonical = QUEST_WORLD_ALIASES[slugOrKey];
  if (!canonical) return undefined;
  return QUEST_WORLDS.find((world) => world.key === canonical);
}

export function isQuestWorldKey(value: unknown): value is string {
  return (
    typeof value === "string" && Object.prototype.hasOwnProperty.call(QUEST_WORLD_ALIASES, value)
  );
}
