import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { restoreSavedLocale } from "@/lib/i18n";
import { AuthContext, useAuthState } from "@/hooks/useAuth";
import { colors } from "@/constants/colors";
import { FONT_ASSETS } from "@/constants/typography";
import { SensoryModeProvider } from "@/context/SensoryModeProvider";
import { PreferencesProvider } from "@/lib/preferences";
import { SplashGate } from "@/components/SplashGate";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30 * 1000,
      networkMode: "offlineFirst",
    },
  },
});

export default function RootLayout() {
  // Inclusive-warm typography: Fredoka (display) + Nunito (body), both
  // bundled. See `constants/typography.ts` for the swap-point note.
  const [fontsLoaded, fontError] = useFonts(FONT_ASSETS);

  const authState = useAuthState();

  // The native splash now stays up until <SplashGate> mounts and hides it
  // itself (so the animated logo is on-screen first — no white flash). The
  // gate also owns the fade to the app, holding until both the fonts are
  // ready and auth has hydrated.
  const ready = (fontsLoaded || !!fontError) && !authState.isLoading;

  // Restore the learner's saved UI locale from a previous launch. Runs
  // exactly once on mount and is intentionally fire-and-forget — the
  // helper itself swallows AsyncStorage errors.
  useEffect(() => {
    void restoreSavedLocale();
  }, []);

  // The sensory-mode provider is mounted inside the auth context
  // (as a child of AuthContext.Provider) so it can read learnerId
  // from the resolved auth state — learners get per-account backend
  // sync; signed-out / parent flows just use local AsyncStorage.
  // `learnerId` is `null` until auth hydrates, which the provider
  // tolerates (local-only mode until an id arrives).
  const learnerId = authState.user?.role === "LEARNER" ? authState.user.id : null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthContext.Provider value={authState}>
            <SensoryModeProvider learnerId={learnerId}>
              <PreferencesProvider learnerId={learnerId}>
                <SplashGate ready={ready}>
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      contentStyle: { backgroundColor: colors.background },
                    }}
                  >
                    <Stack.Screen name="index" />
                    <Stack.Screen name="accept-invite" />
                    <Stack.Screen name="settings/accessibility" />
                    <Stack.Screen name="(onboarding)" options={{ animation: "fade" }} />
                    <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
                    <Stack.Screen name="(parent)" />
                    <Stack.Screen name="(learner)" />
                    <Stack.Screen name="(teacher)" />
                    <Stack.Screen name="(caregiver)" />
                    <Stack.Screen name="(therapist)" />
                  </Stack>
                </SplashGate>
              </PreferencesProvider>
            </SensoryModeProvider>
          </AuthContext.Provider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
