import type { BadgeKey } from "@/lib/db/types";

/**
 * Badge collection medallions for the rewards page.
 *
 * Earned badges show vibrant on a soft primary disc; not-yet-earned ones show
 * the same emoji as a calm, dimmed silhouette — aspiration, never pressure
 * (no shame, no countdowns). The emojis are decorative + universal, so the
 * collection needs no per-badge translation; the list's accessible name
 * carries the real count.
 */
const BADGE_EMOJI: Record<BadgeKey, string> = {
  first_session: "🌱",
  on_fire: "🔥",
  brain_activated: "🧠",
  bookworm: "📚",
  mastery_champion: "🏆",
  goal_getter: "🎯",
  team_player: "🤝",
  multi_subject: "🌈",
  speed_learner: "⚡",
  explorer: "🧭",
};

/** Canonical display order. */
export const ALL_BADGES = Object.keys(BADGE_EMOJI) as BadgeKey[];

export function BadgeCollection({
  earnedKeys,
  ariaLabel,
}: {
  earnedKeys: Set<BadgeKey>;
  ariaLabel: string;
}) {
  return (
    <ul className="flex flex-wrap gap-3" aria-label={ariaLabel}>
      {ALL_BADGES.map((key) => {
        const earned = earnedKeys.has(key);
        return (
          <li
            key={key}
            aria-hidden="true"
            className={`grid h-16 w-16 place-items-center rounded-2xl text-2xl ${
              earned ? "lx-theme-soft-bg lx-pop-in" : ""
            }`}
            style={
              earned
                ? undefined
                : {
                    background: "var(--color-aivo-surface-2)",
                    opacity: 0.45,
                    filter: "grayscale(1)",
                  }
            }
          >
            <span>{BADGE_EMOJI[key]}</span>
          </li>
        );
      })}
    </ul>
  );
}
