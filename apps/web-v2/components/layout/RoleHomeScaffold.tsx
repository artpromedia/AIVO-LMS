import type { ReactNode } from "react";
import { EmptyState, GlassCard, LearningHero, Skeleton } from "@aivo/ui";

export type RoleHomeSection = {
  title: ReactNode;
  cards?: ReactNode;
  emptyState?: ReactNode;
};

export type RoleHomeHero = {
  title: ReactNode;
  subheading: ReactNode;
  tone?: "default" | "calm" | "warm";
  avatarStack?: ReactNode;
  actions?: ReactNode;
};

type RoleHomeScaffoldProps = {
  hero: RoleHomeHero;
  kpiStrip: ReactNode;
  sections: RoleHomeSection[];
  loading?: boolean;
};

const HERO_TONE_CLASS: Record<NonNullable<RoleHomeHero["tone"]>, string> = {
  default: "",
  calm: "from-[var(--aivo-color-aivoTeal-50)] via-white to-[var(--aivo-color-aivoPurple-50)]",
  warm: "from-[var(--aivo-color-aivoOrange-50)] via-white to-[var(--aivo-color-aivoPurple-50)]",
};

function hasCards(cards: ReactNode | undefined) {
  if (cards === undefined || cards === null) return false;
  if (Array.isArray(cards)) return cards.length > 0;
  return true;
}

export function RoleHomeScaffold({ hero, kpiStrip, sections, loading = false }: RoleHomeScaffoldProps) {
  return (
    <div className="flex flex-col gap-6" data-testid="role-home-scaffold">
      <section
        role="region"
        aria-labelledby="role-home-hero-title"
        data-testid="role-home-hero"
        className="space-y-3"
      >
        <LearningHero
          className={HERO_TONE_CLASS[hero.tone ?? "default"]}
          greeting={<span id="role-home-hero-title">{hero.title}</span>}
          subhead={hero.subheading}
          actions={hero.actions}
        />
        {hero.avatarStack ? <div className="px-2 sm:px-3">{hero.avatarStack}</div> : null}
      </section>

      <section
        role="region"
        aria-labelledby="role-home-kpis-title"
        data-testid="role-home-kpi-strip"
        className="space-y-3"
      >
        <h2 id="role-home-kpis-title" className="sr-only">
          Key performance indicators
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <>
              <Skeleton variant="block" className="h-28 rounded-iw-card-lg" />
              <Skeleton variant="block" className="h-28 rounded-iw-card-lg" />
              <Skeleton variant="block" className="h-28 rounded-iw-card-lg" />
            </>
          ) : (
            kpiStrip
          )}
        </div>
      </section>

      {sections.map((section, index) => {
        const headingId = `role-home-section-${index + 1}`;
        const contentVisible = hasCards(section.cards);
        return (
          <section
            key={headingId}
            role="region"
            aria-labelledby={headingId}
            data-testid="role-home-section"
            className="space-y-3"
          >
            <GlassCard elevation="raised" density="comfortable" className="gap-4">
              <h2 id={headingId} className="text-xl font-semibold text-iw-text-strong">
                {section.title}
              </h2>
              {loading ? (
                <Skeleton variant="block" className="h-36 rounded-iw-card" />
              ) : contentVisible ? (
                section.cards
              ) : section.emptyState ? (
                section.emptyState
              ) : (
                <EmptyState title="No content yet" body="Check back soon for updates." />
              )}
            </GlassCard>
          </section>
        );
      })}
    </div>
  );
}
