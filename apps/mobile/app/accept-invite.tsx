/**
 * Mobile counterpart of `apps/web/src/app/accept-invite/page.tsx`.
 *
 * Reachable via the deep link `aivo://accept-invite?email=…` that
 * family-svc emails to invited teachers, caregivers, and therapists
 * (`services/family-svc/src/routes/collaboration.ts`).
 *
 * Flow mirrors the web page:
 *   1. If unauthenticated, stash the full href in SecureStore via
 *      `setPendingDeepLink` and bounce to /(auth)/login. The post-auth
 *      router in `app/index.tsx` consumes the pending link and brings
 *      the user back here once they've signed in.
 *   2. If signed in but the `?email` query param disagrees with the
 *      account email, surface a "wrong account" warning rather than
 *      silently accepting on the wrong identity.
 *   3. Otherwise POST `/api/family/collaboration/accept-invite`. The
 *      endpoint is auth-only (the email is the trust anchor — server
 *      claims `email` must match a row in `learnerTeachers /
 *      learnerCaregivers / learnerTherapists` with status PENDING) so
 *      we just need a bearer token, not a one-time URL token.
 *   4. On success, route to the user's role dashboard (or the
 *      caregiver/teacher/therapist tab when applicable).
 *
 * The endpoint returns `{ accepted: { role, learnerId }[], count }`.
 * `count === 0` is *not* an error — it just means there was nothing
 * pending for this email (e.g. the link was tapped twice). We surface
 * that as a friendly "no pending invitations" state, matching web.
 */
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";
import { setPendingDeepLink } from "@/lib/pendingDeepLink";
import { colors, spacing, radius } from "@/constants/colors";
import { AivoButton } from "@aivo/mobile-ui";

type Status =
  | "checking"
  | "needs_login"
  | "wrong_email"
  | "accepting"
  | "success"
  | "none"
  | "error";

type Accepted = { role: string; learnerId: string };

function continueHrefForRole(role: string | undefined): Href {
  switch (role) {
    case "CAREGIVER":
      return "/(caregiver)" as Href;
    case "TEACHER":
      return "/(teacher)" as Href;
    case "THERAPIST":
      return "/(therapist)" as Href;
    case "PARENT":
      return "/(parent)" as Href;
    default:
      return "/(auth)/login" as Href;
  }
}

export default function AcceptInviteScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { isAuthenticated, isLoading, user } = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();
  const invitedEmail = (typeof params.email === "string" ? params.email : "").trim();

  const [status, setStatus] = useState<Status>("checking");
  const [accepted, setAccepted] = useState<Accepted[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated || !user) {
      // Persist the originating deep link so the post-auth router in
      // index.tsx can bring the user back here. We pass the email param
      // through verbatim so the wrong-account check still fires after
      // sign-in if the user picked a different account.
      const href = invitedEmail
        ? `/accept-invite?email=${encodeURIComponent(invitedEmail)}`
        : "/accept-invite";
      setPendingDeepLink(href).finally(() => {
        setStatus("needs_login");
      });
      return;
    }

    if (invitedEmail && user.email && user.email.toLowerCase() !== invitedEmail.toLowerCase()) {
      setStatus("wrong_email");
      return;
    }

    let cancelled = false;
    setStatus("accepting");
    apiFetch(API.FAMILY, "/api/family/collaboration/accept-invite", {
      method: "POST",
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        const list: Accepted[] = Array.isArray(data?.accepted) ? data.accepted : [];
        setAccepted(list);
        setStatus(list.length > 0 ? "success" : "none");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : t("common.unknownError"));
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [isLoading, isAuthenticated, user, invitedEmail, t]);

  const goToDashboard = () => {
    router.replace(continueHrefForRole(user?.role));
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingTop: insets.top + 24,
        paddingBottom: 32,
        paddingHorizontal: spacing.lg,
      }}
    >
      <View style={styles.card}>
        <Text style={styles.title}>{t("auth.acceptInviteTitle")}</Text>

        {status === "checking" && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.muted}>{t("common.loading")}</Text>
          </View>
        )}

        {status === "needs_login" && (
          <>
            <Text style={styles.body}>
              {invitedEmail
                ? t("auth.acceptInviteNeedsLoginWithEmail", { email: invitedEmail })
                : t("auth.acceptInviteNeedsLogin")}
            </Text>
            <AivoButton
              title={t("auth.acceptInviteHaveAccount")}
              onPress={() => router.replace("/(auth)/login")}
              size="lg"
              style={{ marginTop: spacing.md }}
            />
            <AivoButton
              title={t("auth.acceptInviteCreateAccount")}
              onPress={() => router.replace("/(auth)/signup")}
              size="lg"
              variant="secondary"
              style={{ marginTop: spacing.sm }}
            />
          </>
        )}

        {status === "wrong_email" && (
          <>
            <Text style={styles.warning}>
              {t("auth.acceptInviteWrongEmail", {
                current: user?.email ?? "",
                invited: invitedEmail,
              })}
            </Text>
            <AivoButton
              title={t("auth.acceptInviteSwitchAccount")}
              onPress={() => router.replace("/(auth)/login")}
              size="lg"
              style={{ marginTop: spacing.md }}
            />
          </>
        )}

        {status === "accepting" && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.muted}>{t("auth.acceptInviteAccepting")}</Text>
          </View>
        )}

        {status === "success" && (
          <>
            <Text style={styles.body}>
              {t("auth.acceptInviteSuccess", { count: accepted.length })}
            </Text>
            <AivoButton
              title={t("auth.acceptInviteContinue")}
              onPress={goToDashboard}
              size="lg"
              style={{ marginTop: spacing.md }}
            />
          </>
        )}

        {status === "none" && (
          <>
            <Text style={styles.body}>
              {t("auth.acceptInviteNoneFound", { email: user?.email ?? "" })}
            </Text>
            <AivoButton
              title={t("auth.acceptInviteContinue")}
              onPress={goToDashboard}
              size="lg"
              variant="secondary"
              style={{ marginTop: spacing.md }}
            />
          </>
        )}

        {status === "error" && (
          <>
            <Text style={styles.error}>{t("auth.acceptInviteError", { message: errorMsg })}</Text>
            <AivoButton
              title={t("auth.acceptInviteContinue")}
              onPress={goToDashboard}
              size="lg"
              variant="secondary"
              style={{ marginTop: spacing.md }}
            />
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 22,
    fontFamily: "Nunito-ExtraBold",
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  body: {
    fontSize: 14,
    fontFamily: "Nunito-Regular",
    color: colors.text,
    lineHeight: 20,
    textAlign: "center",
  },
  muted: {
    fontSize: 13,
    fontFamily: "Nunito-Regular",
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  warning: {
    fontSize: 14,
    fontFamily: "Nunito-SemiBold",
    color: colors.text,
    backgroundColor: colors.warning + "15",
    padding: spacing.md,
    borderRadius: radius.md,
    lineHeight: 20,
  },
  error: {
    color: colors.error,
    fontSize: 13,
    fontFamily: "Nunito-SemiBold",
    backgroundColor: colors.error + "10",
    padding: spacing.md,
    borderRadius: radius.md,
  },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.lg },
});
