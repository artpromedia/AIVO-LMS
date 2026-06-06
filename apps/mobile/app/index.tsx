import { useEffect } from "react";
import { router, type Href } from "expo-router";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useAuth } from "@/hooks/useAuth";
import { colors } from "@/constants/colors";
import { AivoLogo } from "@/components/AivoLogo";
import { getPendingDeepLink, clearPendingDeepLink } from "@/lib/pendingDeepLink";

export default function Index() {
  const { isAuthenticated, isLoading, user, mustChangePassword } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated || !user) {
      router.replace("/(auth)/login");
      return;
    }

    // Forced password rotation must be honored before any other surface
    // is reachable. Mirrors the web auth-provider redirect to
    // /dashboard/change-password. Learner (PIN) sessions never set this
    // flag because learners don't have rotating passwords.
    //
    // The `as Href` is the documented expo-router escape hatch for routes
    // whose typed-routes entry hasn't been (re)generated yet — the
    // `(auth)/change-password.tsx` file exists, but `.expo/types/router.d.ts`
    // is regenerated only on dev/build, not on commit.
    if (mustChangePassword) {
      router.replace("/(auth)/change-password" as Href);
      return;
    }

    // If an unauthenticated deep link (e.g. accept-invite) was stashed
    // before sign-in, consume it now. We do this *after* the
    // mustChangePassword gate so a stale invite link can't bypass forced
    // rotation, and *before* role-routing so the user lands where they
    // were originally headed instead of a dashboard.
    let cancelled = false;
    (async () => {
      const pending = await getPendingDeepLink();
      if (cancelled) return;
      if (pending) {
        await clearPendingDeepLink();
        router.replace(pending as Href);
        return;
      }
      switch (user.role) {
        case "PARENT":
          router.replace("/(parent)" as Href);
          break;
        case "LEARNER":
          router.replace("/(learner)" as Href);
          break;
        case "TEACHER":
          router.replace("/(teacher)" as Href);
          break;
        case "CAREGIVER":
          router.replace("/(caregiver)" as Href);
          break;
        case "THERAPIST":
          router.replace("/(therapist)" as Href);
          break;
        default:
          router.replace("/(auth)/login");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoading, user, mustChangePassword]);

  // On-brand auth-routing tick. This view is only visible for the brief
  // moment between hydration finishing and `router.replace` landing the
  // user on their role home, so it keeps the AIVO wordmark on screen
  // rather than dropping to a bare spinner.
  return (
    <View style={styles.container}>
      <AivoLogo variant="purple" width={140} />
      <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  spinner: {
    marginTop: 20,
  },
});
