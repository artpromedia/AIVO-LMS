import { Stack } from "expo-router";

/**
 * Non-destructive showcase group for the new @aivo/mobile-ui/shell
 * primitives (sprint 2, commit 5 of 6). Lives outside the existing
 * (learner)/(parent)/(teacher) groups so a per-role cutover can ship
 * one role at a time without coupling to this preview.
 *
 * Routes:
 *   /(shell-demo)/         — interactive shell preview
 */
export default function ShellDemoLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#F4F6F5" },
      }}
    />
  );
}
