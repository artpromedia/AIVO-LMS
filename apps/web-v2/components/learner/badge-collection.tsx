import type { BadgeKey } from "@/lib/db/types";

/**
 * Named badge collection for the rewards page.
 *
 * Each badge shows its emoji medallion + a friendly name + status. Earned
 * badges are vibrant on the (theme-tinted) soft disc; not-yet-earned ones are
 * calm, dimmed silhouettes with a gentle "keep exploring" line — aspiration,
 * never pressure (no shame, no countdowns).
 *
 * Badge names are short gamification labels held here as data — the same
 * convention as the tutor names (Nova / Sage) and theme names (Aurora), which
 * ship as brand vocabulary across locales. Only the status text is localized
 * (passed in by the page).
 */
const BADGE_META: Record<BadgeKey, { emoji: string; name: string }> = {
  first_session: { emoji: "🌱", name: "First Steps" },
  on_fire: { emoji: "🔥", name: "On Fire" },
  brain_activated: { emoji: "🧠", name: "Brain Boost" },
  bookworm: { emoji: "📚", name: "Bookworm" },
  mastery_champion: { emoji: "🏆", name: "Mastery Star" },
  goal_getter: { emoji: "🎯", name: "Goal Getter" },
  team_player: { emoji: "🤝", name: "Team Player" },
  multi_subject: { emoji: "🌈", name: "World Hopper" },
  speed_learner: { emoji: "⚡", name: "Quick Thinker" },
  explorer: { emoji: "🧭", name: "Explorer" },
};

/** Canonical display order. */
export const ALL_BADGES = Object.keys(BADGE_META) as BadgeKey[];

export function BadgeCollection({
  earnedKeys,
  earnedLabel,
  howtoLabel,
}: {
  earnedKeys: Set<BadgeKey>;
  earnedLabel: string;
  howtoLabel: string;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {ALL_BADGES.map((key) => {
        const earned = earnedKeys.has(key);
        const meta = BADGE_META[key];
        return (
          <li
            key={key}
            className="flex flex-col items-center gap-2 rounded-iw-card border border-iw-border/60 bg-white p-3 text-center"
          >
            <span
              className={`grid h-14 w-14 place-items-center rounded-iw-control text-2xl ${
                earned ? "lx-theme-soft-bg lx-pop-in" : ""
              }`}
              style={
                earned
                  ? undefined
                  : {
                      background: "var(--color-aivo-surface-2)",
                      opacity: 0.5,
                      filter: "grayscale(1)",
                    }
              }
              aria-hidden="true"
            >
              {meta.emoji}
            </span>
            <span
              className={`text-xs font-bold leading-tight ${
                earned ? "text-iw-text-strong" : "text-iw-text-muted"
              }`}
            >
              {meta.name}
            </span>
            <span className="text-[11px] leading-tight text-iw-text-muted">
              {earned ? earnedLabel : howtoLabel}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
