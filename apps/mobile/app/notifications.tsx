/**
 * Top-level Notifications screen — ADR 0020 Phase 2, slice 1.
 *
 * The canonical mobile route for the notifications surface, mirroring
 * the web `/notifications` page. Anchored on the `messages` NavArea
 * per `CROSS_CUTTING_REGISTRY.notifications` (`@aivo/nav`), so the
 * four access outcomes — `allow` / `switch-role` / `locked` /
 * `forbidden` — come from the same `canAccessArea` helper the web
 * `<RoleGate>` uses. No parallel RBAC table.
 *
 * Implementation note: the unified mobile `RoleProvider` is still
 * gated behind the `MOBILE_UNIFIED_APP` rollout and not mounted at
 * the root layout yet, so we synthesise a `RoleSession` directly from
 * `useAuth()` rather than depending on `useNavAccess()` (which
 * requires `RoleProvider` to be in scope). Once the unified shell
 * lands, swap the direct call for
 * `useNavAccess({ area: "messages", … })` — the outcome contract is
 * identical.
 *
 * Responsive note: the screen roots through `ResponsiveScreen`
 * (`maxWidth="reading"`) so the notifications column is capped at the
 * reading width on tablets instead of stretching edge-to-edge, and the
 * hand-rolled inset/padding math is dropped in favour of the shared
 * scaffold.
 *
 * i18n note: the primary strings reuse the existing
 * `caregiverNotifications.*` namespace so this slice does not have to
 * land a new key across 10 locales; the rare-path access-decision
 * copy (switch-role / locked / forbidden) is intentionally inline
 * English for now and will be lifted into the catalog alongside the
 * unified inbox port.
 */
import React, { useMemo } from "react";
import { Text, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { EmptyState } from "@aivo/mobile-ui";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/hooks/useTranslation";
import { colors, spacing } from "@/constants/colors";
import { ResponsiveScreen } from "@/src/components/layout/ResponsiveScreen";
import { buildMobileRoleSession, getMobileNavAccess, toNavRole } from "@/lib/nav-access";

export default function NotificationsScreen() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { t } = useTranslation();

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
      <Text style={styles.title}>{t("caregiverNotifications.title")}</Text>
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
        title="Sign in to see your notifications"
        message="You need to be signed in to view this surface."
      />,
    );
  }

  if (decision.outcome === "switch-role" && decision.requiredRole) {
    return screen(
      <EmptyState
        icon={<Ionicons name="swap-horizontal-outline" size={48} color={colors.textSecondary} />}
        title="Switch role to continue"
        message={`Notifications for this area are available under your ${decision.requiredRole} role.`}
      />,
    );
  }

  if (decision.outcome === "locked") {
    return screen(
      <EmptyState
        icon={<Ionicons name="lock-closed-outline" size={48} color={colors.textSecondary} />}
        title="Notifications are not available"
        message={decision.lockReason ?? "Notifications are not available for your current role."}
      />,
    );
  }

  if (decision.outcome === "forbidden") {
    return screen(
      <EmptyState
        icon={<Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />}
        title="You don't have access"
        message="Notifications aren't available for your current account."
      />,
    );
  }

  // `allow` — render the role-agnostic empty-state shell. The real
  // notifications fetch will land alongside the unified-inbox port in
  // a follow-up; for now this matches the legacy
  // `(caregiver)/notifications.tsx` UX so behavioural parity is
  // preserved while the route flips to the canonical location.
  return (
    <ResponsiveScreen maxWidth="reading">
      <Text style={styles.title}>{t("caregiverNotifications.title")}</Text>
      <Text style={styles.subtitle}>{t("caregiverNotifications.subtitle")}</Text>
      <EmptyState
        icon={<Ionicons name="notifications-outline" size={48} color={colors.textSecondary} />}
        title={t("caregiverNotifications.noNotificationsTitle")}
        message={t("caregiverNotifications.noNotificationsMessage")}
      />
    </ResponsiveScreen>
  );
}

const styles = StyleSheet.create({
  center: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontFamily: "Nunito-ExtraBold", color: colors.text },
  subtitle: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
});
