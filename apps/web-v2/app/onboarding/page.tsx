/**
 * /onboarding entry — redirects to the welcome screen.
 */
import { redirect } from "next/navigation";

export default function OnboardingIndex() {
  redirect("/onboarding/welcome");
}
