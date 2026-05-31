import { Stack } from "expo-router";

/**
 * Pre-auth onboarding flow — the mobile mirror of web's `/onboarding/*`.
 * Reachable from the login screen ("New to AIVO? Get started"). Static /
 * device-permission screens only; account creation continues into the
 * existing `(auth)` group.
 *
 * Routes: index (entry) · welcome · role · terms · privacy · permissions
 * · error.
 */
export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="welcome" />
      <Stack.Screen name="role" />
      <Stack.Screen name="terms" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="permissions" />
      <Stack.Screen name="error" />
    </Stack>
  );
}
