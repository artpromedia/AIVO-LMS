import styles from "./parent-home-hero.module.css";

/**
 * Parent Home hero (ParentApp.dc.html → isHome).
 *
 * The calm gradient banner: greeting + "ready for today's mission" subline +
 * supporting copy + the primary/secondary actions on the left, and the
 * learner snapshot card tucked into the hero on the right (the design places
 * it inside the hero, not as a separate section). The learner switcher pills
 * sit along the bottom. Pure presentational shell — all copy/data come from
 * the caller (real repo values).
 */
export function ParentHomeHero({
  greeting,
  subline,
  subhead,
  actions,
  snapshot,
  pills,
}: {
  greeting: React.ReactNode;
  subline: React.ReactNode;
  subhead: React.ReactNode;
  actions: React.ReactNode;
  snapshot?: React.ReactNode;
  pills?: React.ReactNode;
}) {
  return (
    <section className={`${styles.hero} p-7 sm:p-8`}>
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="max-w-[560px]">
          <h1 className="font-iw-display text-[2rem] font-bold leading-[1.12] text-iw-text-strong sm:text-[2.125rem]">
            {greeting}
          </h1>
          <p className="mt-1 font-iw-display text-2xl font-bold text-iw-text-muted">{subline}</p>
          <p className="mt-2 max-w-[34rem] text-[15px] leading-relaxed text-iw-text-muted">
            {subhead}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">{actions}</div>
        </div>
        {snapshot ? <div className="w-[300px] max-w-full">{snapshot}</div> : null}
      </div>
      {pills ? <div className="mt-6">{pills}</div> : null}
    </section>
  );
}

ParentHomeHero.displayName = "Parent/ParentHomeHero";
