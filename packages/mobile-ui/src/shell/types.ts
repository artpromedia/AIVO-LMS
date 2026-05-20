/**
 * Mobile shell types — shared shapes for tab bar, role switcher,
 * and locked screen. These wrap the registry-level types in
 * @aivo/nav so RN consumers never have to reach across packages.
 */
import type { Role, NavArea } from "@aivo/nav";
import type { ReactNode } from "react";

export type { Role, NavArea };

export interface MobileAccountSummary {
  name: string;
  email?: string;
  initials?: string;
}

export interface MobileRoleOption {
  id: Role;
  available: boolean;
  lastUsedAt?: string;
}

/**
 * Icon resolver passed in by the host app. Mobile-ui stays
 * icon-library-agnostic (Expo apps usually ship `@expo/vector-icons`
 * or `lucide-react-native`); the host wires the actual glyph.
 */
export type NavIconRenderer = (area: NavArea, active: boolean) => ReactNode;
