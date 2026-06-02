/**
 * Onboarding shared layout — keeps the calm canvas + global brand
 * gradient consistent across every screen in the 16-screen auth /
 * consent / first-run flow.
 */
import * as React from "react";

export const metadata = {
  title: "Welcome to AIVO",
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
