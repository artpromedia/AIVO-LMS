/**
 * Shared types for shell primitives. Re-exports the @aivo/nav types
 * the shell needs so apps can import everything from "@aivo/ui/shell".
 */
import type { NavArea, Role } from "@aivo/nav";

export type { NavArea, Role };

export interface AccountSummary {
  name: string;
  email: string;
  /** Initials shown when no avatar URL is provided. */
  initials?: string;
  avatarUrl?: string;
}

export interface RoleOption {
  id: Role;
  /** Whether this role is currently selectable for the signed-in user. */
  available: boolean;
  /** Optional last-active marker shown in the role-switcher list. */
  lastUsedAt?: string;
}

export interface ShellLink {
  href: string;
  label: string;
  /** Optional badge count, e.g. unread messages. */
  badge?: number;
}
