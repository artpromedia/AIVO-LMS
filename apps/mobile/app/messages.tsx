/**
 * Top-level Messages screen — ADR 0020 Phase 2, slice 2.
 *
 * The canonical mobile route for the messages surface, mirroring the
 * web `/messages` page. Anchored on the `messages` NavArea per
 * `CROSS_CUTTING_REGISTRY.messages` (`@aivo/nav`), so the four access
 * outcomes — `allow` / `switch-role` / `locked` / `forbidden` — come
 * from the same `canAccessArea` helper the web `<RoleGate>` uses. No
 * parallel RBAC table.
 *
 * Implementation note: identical to the slice 1 (`notifications`)
 * mobile screen, the unified mobile `RoleProvider` is still gated
 * behind the `MOBILE_UNIFIED_APP` rollout and not mounted at the root
 * layout yet, so we synthesise a `RoleSession` directly from
 * `useAuth()` rather than depending on `useNavAccess()`. Once the
 * unified shell lands, swap the direct call for
 * `useNavAccess({ area: "messages", … })` — the outcome contract is
 * identical.
 *
 * Responsive note: the screen roots through `ResponsiveScreen`
 * (`maxWidth="reading"`) so the inbox column is capped at the reading
 * width on tablets instead of stretching edge-to-edge. The `allow`
 * path renders the threaded `MessagesInbox` inside the non-scrolling
 * variant (`scroll={false}` + `innerStyle.flex`) because the inbox owns
 * its own master/detail scrolling; every other state uses the default
 * scrolling variant.
 *
 * i18n note: no `messages.*` namespace exists yet, and Phase 2 §rules
 * forbids forking copy across 10 locale catalogs for a placeholder
 * surface. Strings are intentionally inline English for now and will
 * be lifted into the catalog alongside the unified inbox port.
 */
import React, { useMemo } from "react";
import { Text, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { EmptyState } from "@aivo/mobile-ui";
import { useAuth } from "@/hooks/useAuth";
import { colors, spacing } from "@/constants/colors";
import { MessagesInbox } from "@/components/messages/MessagesInbox";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { buildMobileRoleSession, getMobileNavAccess, toNavRole } from "@/lib/nav-access";

export default function MessagesScreen() {
  const { user, isAuthenticated, isLoading } = useAuth();

  const decision = useMemo(() => {
    if (!user) return null;
    const navRole = toNavRole(user.role);
    if (!navRole) return null;
    const session = buildMobileRoleSession({
      id: user.id,
      tenantId: user.tenantId,
      // The mobile auth context still models the user as single-role;
      // `availableRoles` will widen to the BFF /me payload once the
      // unified shell lifts the additional roles from cookies.
      availableRoles: [user.role],
      activeRole: user.role,
    });
    return getMobileNavAccess(session, "messages");
  }, [user]);

  const screen = (body: React.ReactNode) => (
    <ResponsiveScreen maxWidth="reading">
      <Text style={styles.title}>Messages</Text>
      {body}
    </ResponsiveScreen>
  );

  if (isLoading) {
    return (
      <ResponsiveScreen maxWidth="reading" contentContainerStyle={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </ResponsiveScreen>
    );
  }

  if (!isAuthenticated || !user || !decision) {
    return screen(
      <EmptyState
        icon={<Ionicons name="person-outline" size={48} color={colors.textSecondary} />}
        title="Sign in to see your messages"
        message="You need to be signed in to view this surface."
      />,
    );
  }

  if (decision.outcome === "switch-role" && decision.requiredRole) {
    return screen(
      <EmptyState
        icon={<Ionicons name="swap-horizontal-outline" size={48} color={colors.textSecondary} />}
        title="Switch role to continue"
        message={`Messages for this area are available under your ${decision.requiredRole} role.`}
      />,
    );
  }

  if (decision.outcome === "locked") {
    return screen(
      <EmptyState
        icon={<Ionicons name="lock-closed-outline" size={48} color={colors.textSecondary} />}
        title="Messages are not available"
        message={decision.lockReason ?? "Messages are not available for your current role."}
      />,
    );
  }

  if (decision.outcome === "forbidden") {
    return screen(
      <EmptyState
        icon={<Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />}
        title="You don't have access"
        message="Messages aren't available for your current account."
      />,
    );
  }

  // `allow` — render the real threaded inbox (mirrors web `/messages`).
  // The inbox owns its own scrolling, so use the non-scrolling variant
  // and let the inner column flex to fill the remaining height.
  return (
    <ResponsiveScreen maxWidth="reading" scroll={false} innerStyle={styles.inboxInner}>
      <Text style={styles.title}>Messages</Text>
      <Text style={styles.subtitle}>Conversations with your AIVO team.</Text>
      <MessagesInbox />
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  center: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  inboxInner: { flex: 1 },
  title: { fontSize: 24, fontFamily: "Nunito-ExtraBold", color: colors.text },
  subtitle: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
});
