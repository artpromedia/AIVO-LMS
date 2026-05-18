import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import "@/lib/i18n";
import { AuthContext, useAuthState } from "@/hooks/useAuth";
import { colors } from "@/constants/colors";

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
  const [fontsLoaded, fontError] = useFonts({
    "Nunito-Regular": require("@/assets/fonts/Nunito-Regular.ttf"),
    "Nunito-Bold": require("@/assets/fonts/Nunito-Bold.ttf"),
    "Nunito-SemiBold": require("@/assets/fonts/Nunito-SemiBold.ttf"),
    "Nunito-ExtraBold": require("@/assets/fonts/Nunito-ExtraBold.ttf"),
  });

  const authState = useAuthState();

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthContext.Provider value={authState}>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="accept-invite" />
              <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
              <Stack.Screen name="(parent)" />
              <Stack.Screen name="(learner)" />
              <Stack.Screen name="(teacher)" />
              <Stack.Screen name="(caregiver)" />
              <Stack.Screen name="(therapist)" />
            </Stack>
          </AuthContext.Provider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
