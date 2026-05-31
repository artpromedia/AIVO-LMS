import { Redirect } from "expo-router";

/**
 * Onboarding entry (MOB-ONB-001) — mirror of web's `/onboarding`, which
 * routes straight into the welcome step.
 */
export default function OnboardingEntry() {
  return <Redirect href={"/(onboarding)/welcome" as never} />;
}
