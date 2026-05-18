import React from "react";
import { TabletScaffold } from "./TabletScaffold";
import type { RailDestination } from "./RoleNavigationRail";
import { useWindowSizeClass } from "../../design/useWindowSizeClass";

interface RoleTabletShellProps {
  destinations: RailDestination[];
  children: React.ReactNode;
}

/**
 * Wraps a role's expo-router `<Tabs>` navigator with a persistent
 * left navigation rail on tablet form factors. On phones it passes
 * through, leaving the bottom tab bar as the primary nav.
 *
 * Place this in each role `_layout.tsx` so the rail is rendered once
 * at the layout level and stays visible across every tab route —
 * fixes the nav-dead-end that occurs when individual screens hide
 * the bottom bar on tablet but only the dashboard index supplies its
 * own rail.
 */
export function RoleTabletShell({ destinations, children }: RoleTabletShellProps) {
  const { isTablet } = useWindowSizeClass();
  if (!isTablet) return <>{children}</>;
  return <TabletScaffold destinations={destinations}>{children}</TabletScaffold>;
}
