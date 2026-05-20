import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NAV_AREAS, type NavArea, type Role } from "@aivo/nav";
import { LockedScreen } from "@aivo/ui";

export const dynamic = "force-static";

interface Params {
  params: Promise<{ area: string }>;
  searchParams: Promise<{ role?: string }>;
}

const VALID_ROLES: ReadonlySet<Role> = new Set<Role>([
  "learner",
  "parent",
  "teacher",
  "schoolAdmin",
  "districtAdmin",
  "internal",
]);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { area } = await params;
  return { title: `Locked · ${area} · AIVO` };
}

/**
 * Universal locked screen. The `@aivo/nav` registry decides the copy
 * (lock reason + CTA); this route is just a thin wrapper that:
 *
 *  1. Validates the `area` is a real NavArea.
 *  2. Picks up the current role from `?role=` (host's role provider
 *     can pre-populate the query when redirecting; defaults to
 *     `parent` since it's the most common signed-in role).
 */
export default async function LockedRoute({ params, searchParams }: Params) {
  const { area: rawArea } = await params;
  const { role: rawRole } = await searchParams;

  const area = rawArea as NavArea;
  if (!NAV_AREAS.includes(area)) {
    notFound();
  }

  const role: Role = VALID_ROLES.has(rawRole as Role)
    ? (rawRole as Role)
    : "parent";

  return (
    <main
      id="main"
      className="min-h-screen bg-[var(--aivo-color-surface-canvas,#f4f6f5)]"
    >
      <LockedScreen role={role} area={area} linkAs={Link} />
    </main>
  );
}
