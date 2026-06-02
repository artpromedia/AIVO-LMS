/* eslint-disable */
import * as Router from "expo-router";

export * from "expo-router";

declare module "expo-router" {
  export namespace ExpoRouter {
    export interface __routes<T extends string | object = string> {
      hrefInputParams:
        | { pathname: Router.RelativePathString; params?: Router.UnknownInputParams }
        | { pathname: Router.ExternalPathString; params?: Router.UnknownInputParams }
        | { pathname: `/accept-invite`; params?: Router.UnknownInputParams }
        | { pathname: `/`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../../packages/mobile-ui/src/shell/types`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../../packages/mobile-ui/src/shell/RoleAwareTabBar`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../../packages/mobile-ui/src/shell/RoleSwitcherSheet`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../../packages/mobile-ui/src/shell/LockedScreenMobile`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../../packages/mobile-ui/src/shell/index`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `${"/(shell-demo)"}/index` | `/index`; params?: Router.UnknownInputParams }
        | {
            pathname: `${"/(auth)"}/consent-sheet` | `/consent-sheet`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${"/(auth)"}/biometric-setup` | `/biometric-setup`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${"/(auth)"}/session-switch` | `/session-switch`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `${"/(parent)"}/home-v2` | `/home-v2`; params?: Router.UnknownInputParams }
        | { pathname: `/_sitemap`; params?: Router.UnknownInputParams }
        | {
            pathname: `${"/(auth)"}/change-password` | `/change-password`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${"/(auth)"}/forgot-password` | `/forgot-password`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `${"/(auth)"}/login` | `/login`; params?: Router.UnknownInputParams }
        | { pathname: `${"/(auth)"}/pin` | `/pin`; params?: Router.UnknownInputParams }
        | {
            pathname: `${"/(auth)"}/reset-password` | `/reset-password`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `${"/(auth)"}/signup` | `/signup`; params?: Router.UnknownInputParams }
        | {
            pathname: `${"/(auth)"}/verify-mfa` | `/verify-mfa`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `${"/(caregiver)"}` | `/`; params?: Router.UnknownInputParams }
        | {
            pathname: `${"/(caregiver)"}/notifications` | `/notifications`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${"/(caregiver)"}/settings` | `/settings`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${"/(learner)"}/adventure` | `/adventure`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `${"/(learner)"}/badges` | `/badges`; params?: Router.UnknownInputParams }
        | { pathname: `${"/(learner)"}/brain` | `/brain`; params?: Router.UnknownInputParams }
        | {
            pathname: `${"/(learner)"}/challenges` | `/challenges`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${"/(learner)"}/gamification` | `/gamification`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${"/(learner)"}/gradebook` | `/gradebook`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `${"/(learner)"}` | `/`; params?: Router.UnknownInputParams }
        | {
            pathname: `${"/(learner)"}/leaderboard` | `/leaderboard`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `${"/(learner)"}/settings` | `/settings`; params?: Router.UnknownInputParams }
        | { pathname: `${"/(learner)"}/shop` | `/shop`; params?: Router.UnknownInputParams }
        | { pathname: `${"/(learner)"}/homework` | `/homework`; params?: Router.UnknownInputParams }
        | { pathname: `${"/(learner)"}/quests` | `/quests`; params?: Router.UnknownInputParams }
        | { pathname: `${"/(parent)"}/billing` | `/billing`; params?: Router.UnknownInputParams }
        | { pathname: `${"/(parent)"}/inbox` | `/inbox`; params?: Router.UnknownInputParams }
        | { pathname: `${"/(parent)"}` | `/`; params?: Router.UnknownInputParams }
        | { pathname: `${"/(parent)"}/onboard` | `/onboard`; params?: Router.UnknownInputParams }
        | {
            pathname: `${"/(parent)"}/recommendations` | `/recommendations`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `${"/(parent)"}/settings` | `/settings`; params?: Router.UnknownInputParams }
        | { pathname: `${"/(parent)"}/tutors` | `/tutors`; params?: Router.UnknownInputParams }
        | {
            pathname: `${"/(teacher)"}/analytics` | `/analytics`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `${"/(teacher)"}` | `/`; params?: Router.UnknownInputParams }
        | {
            pathname: `${"/(teacher)"}/lesson-plan` | `/lesson-plan`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `${"/(teacher)"}/settings` | `/settings`; params?: Router.UnknownInputParams }
        | { pathname: `${"/(therapist)"}` | `/`; params?: Router.UnknownInputParams }
        | {
            pathname: `${"/(therapist)"}/sessions` | `/sessions`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${"/(therapist)"}/settings` | `/settings`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname:
              | `${"/(caregiver)"}/child/[childId]/accommodations`
              | `/child/[childId]/accommodations`;
            params: Router.UnknownInputParams & { childId: string | number };
          }
        | {
            pathname: `${"/(caregiver)"}/child/[childId]/brain` | `/child/[childId]/brain`;
            params: Router.UnknownInputParams & { childId: string | number };
          }
        | {
            pathname: `${"/(caregiver)"}/child/[childId]/gradebook` | `/child/[childId]/gradebook`;
            params: Router.UnknownInputParams & { childId: string | number };
          }
        | {
            pathname: `${"/(caregiver)"}/child/[childId]/iep-goals` | `/child/[childId]/iep-goals`;
            params: Router.UnknownInputParams & { childId: string | number };
          }
        | {
            pathname: `${"/(caregiver)"}/child/[childId]` | `/child/[childId]`;
            params: Router.UnknownInputParams & { childId: string | number };
          }
        | {
            pathname:
              | `${"/(caregiver)"}/child/[childId]/observation`
              | `/child/[childId]/observation`;
            params: Router.UnknownInputParams & { childId: string | number };
          }
        | {
            pathname: `${"/(caregiver)"}/child/[childId]/progress` | `/child/[childId]/progress`;
            params: Router.UnknownInputParams & { childId: string | number };
          }
        | {
            pathname: `${"/(caregiver)"}/child/[childId]/sessions` | `/child/[childId]/sessions`;
            params: Router.UnknownInputParams & { childId: string | number };
          }
        | {
            pathname: `${"/(learner)"}/homework/[sessionId]` | `/homework/[sessionId]`;
            params: Router.UnknownInputParams & { sessionId: string | number };
          }
        | {
            pathname: `${"/(learner)"}/quests/[worldSlug]` | `/quests/[worldSlug]`;
            params: Router.UnknownInputParams & { worldSlug: string | number };
          }
        | {
            pathname:
              | `${"/(learner)"}/quests/[worldSlug]/play/[questId]`
              | `/quests/[worldSlug]/play/[questId]`;
            params: Router.UnknownInputParams & {
              worldSlug: string | number;
              questId: string | number;
            };
          }
        | {
            pathname: `${"/(learner)"}/stage/[sessionId]` | `/stage/[sessionId]`;
            params: Router.UnknownInputParams & { sessionId: string | number };
          }
        | {
            pathname: `${"/(learner)"}/tutor/[tutorSlug]` | `/tutor/[tutorSlug]`;
            params: Router.UnknownInputParams & { tutorSlug: string | number };
          }
        | {
            pathname: `${"/(parent)"}/brain/[childId]/history` | `/brain/[childId]/history`;
            params: Router.UnknownInputParams & { childId: string | number };
          }
        | {
            pathname: `${"/(parent)"}/brain/[childId]` | `/brain/[childId]`;
            params: Router.UnknownInputParams & { childId: string | number };
          }
        | {
            pathname: `${"/(parent)"}/brain/[childId]/[domain]` | `/brain/[childId]/[domain]`;
            params: Router.UnknownInputParams & {
              childId: string | number;
              domain: string | number;
            };
          }
        | {
            pathname: `${"/(parent)"}/colearn/[childId]` | `/colearn/[childId]`;
            params: Router.UnknownInputParams & { childId: string | number };
          }
        | {
            pathname: `${"/(parent)"}/iep/[childId]` | `/iep/[childId]`;
            params: Router.UnknownInputParams & { childId: string | number };
          }
        | {
            pathname: `${"/(parent)"}/milestones/[childId]` | `/milestones/[childId]`;
            params: Router.UnknownInputParams & { childId: string | number };
          }
        | {
            pathname: `${"/(parent)"}/progress/[childId]` | `/progress/[childId]`;
            params: Router.UnknownInputParams & { childId: string | number };
          }
        | {
            pathname: `${"/(parent)"}/session/[childId]` | `/session/[childId]`;
            params: Router.UnknownInputParams & { childId: string | number };
          }
        | {
            pathname: `${"/(parent)"}/team/[childId]` | `/team/[childId]`;
            params: Router.UnknownInputParams & { childId: string | number };
          }
        | {
            pathname: `${"/(teacher)"}/student/[id]/iep` | `/student/[id]/iep`;
            params: Router.UnknownInputParams & { id: string | number };
          }
        | {
            pathname: `${"/(teacher)"}/student/[id]` | `/student/[id]`;
            params: Router.UnknownInputParams & { id: string | number };
          }
        | {
            pathname: `${"/(teacher)"}/student/[id]/insight` | `/student/[id]/insight`;
            params: Router.UnknownInputParams & { id: string | number };
          }
        | {
            pathname: `${"/(therapist)"}/client/[id]/goals` | `/client/[id]/goals`;
            params: Router.UnknownInputParams & { id: string | number };
          }
        | {
            pathname: `${"/(therapist)"}/client/[id]` | `/client/[id]`;
            params: Router.UnknownInputParams & { id: string | number };
          }
        | {
            pathname: `${"/(therapist)"}/client/[id]/notes` | `/client/[id]/notes`;
            params: Router.UnknownInputParams & { id: string | number };
          }
        | {
            pathname: `${"/(therapist)"}/client/[id]/reports` | `/client/[id]/reports`;
            params: Router.UnknownInputParams & { id: string | number };
          };
      hrefOutputParams:
        | { pathname: Router.RelativePathString; params?: Router.UnknownOutputParams }
        | { pathname: Router.ExternalPathString; params?: Router.UnknownOutputParams }
        | { pathname: `/accept-invite`; params?: Router.UnknownOutputParams }
        | { pathname: `/`; params?: Router.UnknownOutputParams }
        | {
            pathname: `/../../../packages/mobile-ui/src/shell/types`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../../packages/mobile-ui/src/shell/RoleAwareTabBar`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../../packages/mobile-ui/src/shell/RoleSwitcherSheet`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../../packages/mobile-ui/src/shell/LockedScreenMobile`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `/../../../packages/mobile-ui/src/shell/index`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `${"/(shell-demo)"}/index` | `/index`; params?: Router.UnknownOutputParams }
        | {
            pathname: `${"/(auth)"}/consent-sheet` | `/consent-sheet`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `${"/(auth)"}/biometric-setup` | `/biometric-setup`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `${"/(auth)"}/session-switch` | `/session-switch`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `${"/(parent)"}/home-v2` | `/home-v2`; params?: Router.UnknownOutputParams }
        | { pathname: `/_sitemap`; params?: Router.UnknownOutputParams }
        | {
            pathname: `${"/(auth)"}/change-password` | `/change-password`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `${"/(auth)"}/forgot-password` | `/forgot-password`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `${"/(auth)"}/login` | `/login`; params?: Router.UnknownOutputParams }
        | { pathname: `${"/(auth)"}/pin` | `/pin`; params?: Router.UnknownOutputParams }
        | {
            pathname: `${"/(auth)"}/reset-password` | `/reset-password`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `${"/(auth)"}/signup` | `/signup`; params?: Router.UnknownOutputParams }
        | {
            pathname: `${"/(auth)"}/verify-mfa` | `/verify-mfa`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `${"/(caregiver)"}` | `/`; params?: Router.UnknownOutputParams }
        | {
            pathname: `${"/(caregiver)"}/notifications` | `/notifications`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `${"/(caregiver)"}/settings` | `/settings`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `${"/(learner)"}/adventure` | `/adventure`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `${"/(learner)"}/badges` | `/badges`; params?: Router.UnknownOutputParams }
        | { pathname: `${"/(learner)"}/brain` | `/brain`; params?: Router.UnknownOutputParams }
        | {
            pathname: `${"/(learner)"}/challenges` | `/challenges`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `${"/(learner)"}/gamification` | `/gamification`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `${"/(learner)"}/gradebook` | `/gradebook`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `${"/(learner)"}` | `/`; params?: Router.UnknownOutputParams }
        | {
            pathname: `${"/(learner)"}/leaderboard` | `/leaderboard`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `${"/(learner)"}/settings` | `/settings`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `${"/(learner)"}/shop` | `/shop`; params?: Router.UnknownOutputParams }
        | {
            pathname: `${"/(learner)"}/homework` | `/homework`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `${"/(learner)"}/quests` | `/quests`; params?: Router.UnknownOutputParams }
        | { pathname: `${"/(parent)"}/billing` | `/billing`; params?: Router.UnknownOutputParams }
        | { pathname: `${"/(parent)"}/inbox` | `/inbox`; params?: Router.UnknownOutputParams }
        | { pathname: `${"/(parent)"}` | `/`; params?: Router.UnknownOutputParams }
        | { pathname: `${"/(parent)"}/onboard` | `/onboard`; params?: Router.UnknownOutputParams }
        | {
            pathname: `${"/(parent)"}/recommendations` | `/recommendations`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `${"/(parent)"}/settings` | `/settings`; params?: Router.UnknownOutputParams }
        | { pathname: `${"/(parent)"}/tutors` | `/tutors`; params?: Router.UnknownOutputParams }
        | {
            pathname: `${"/(teacher)"}/analytics` | `/analytics`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `${"/(teacher)"}` | `/`; params?: Router.UnknownOutputParams }
        | {
            pathname: `${"/(teacher)"}/lesson-plan` | `/lesson-plan`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `${"/(teacher)"}/settings` | `/settings`;
            params?: Router.UnknownOutputParams;
          }
        | { pathname: `${"/(therapist)"}` | `/`; params?: Router.UnknownOutputParams }
        | {
            pathname: `${"/(therapist)"}/sessions` | `/sessions`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname: `${"/(therapist)"}/settings` | `/settings`;
            params?: Router.UnknownOutputParams;
          }
        | {
            pathname:
              | `${"/(caregiver)"}/child/[childId]/accommodations`
              | `/child/[childId]/accommodations`;
            params: Router.UnknownOutputParams & { childId: string };
          }
        | {
            pathname: `${"/(caregiver)"}/child/[childId]/brain` | `/child/[childId]/brain`;
            params: Router.UnknownOutputParams & { childId: string };
          }
        | {
            pathname: `${"/(caregiver)"}/child/[childId]/gradebook` | `/child/[childId]/gradebook`;
            params: Router.UnknownOutputParams & { childId: string };
          }
        | {
            pathname: `${"/(caregiver)"}/child/[childId]/iep-goals` | `/child/[childId]/iep-goals`;
            params: Router.UnknownOutputParams & { childId: string };
          }
        | {
            pathname: `${"/(caregiver)"}/child/[childId]` | `/child/[childId]`;
            params: Router.UnknownOutputParams & { childId: string };
          }
        | {
            pathname:
              | `${"/(caregiver)"}/child/[childId]/observation`
              | `/child/[childId]/observation`;
            params: Router.UnknownOutputParams & { childId: string };
          }
        | {
            pathname: `${"/(caregiver)"}/child/[childId]/progress` | `/child/[childId]/progress`;
            params: Router.UnknownOutputParams & { childId: string };
          }
        | {
            pathname: `${"/(caregiver)"}/child/[childId]/sessions` | `/child/[childId]/sessions`;
            params: Router.UnknownOutputParams & { childId: string };
          }
        | {
            pathname: `${"/(learner)"}/homework/[sessionId]` | `/homework/[sessionId]`;
            params: Router.UnknownOutputParams & { sessionId: string };
          }
        | {
            pathname: `${"/(learner)"}/quests/[worldSlug]` | `/quests/[worldSlug]`;
            params: Router.UnknownOutputParams & { worldSlug: string };
          }
        | {
            pathname:
              | `${"/(learner)"}/quests/[worldSlug]/play/[questId]`
              | `/quests/[worldSlug]/play/[questId]`;
            params: Router.UnknownOutputParams & { worldSlug: string; questId: string };
          }
        | {
            pathname: `${"/(learner)"}/stage/[sessionId]` | `/stage/[sessionId]`;
            params: Router.UnknownOutputParams & { sessionId: string };
          }
        | {
            pathname: `${"/(learner)"}/tutor/[tutorSlug]` | `/tutor/[tutorSlug]`;
            params: Router.UnknownOutputParams & { tutorSlug: string };
          }
        | {
            pathname: `${"/(parent)"}/brain/[childId]/history` | `/brain/[childId]/history`;
            params: Router.UnknownOutputParams & { childId: string };
          }
        | {
            pathname: `${"/(parent)"}/brain/[childId]` | `/brain/[childId]`;
            params: Router.UnknownOutputParams & { childId: string };
          }
        | {
            pathname: `${"/(parent)"}/brain/[childId]/[domain]` | `/brain/[childId]/[domain]`;
            params: Router.UnknownOutputParams & { childId: string; domain: string };
          }
        | {
            pathname: `${"/(parent)"}/colearn/[childId]` | `/colearn/[childId]`;
            params: Router.UnknownOutputParams & { childId: string };
          }
        | {
            pathname: `${"/(parent)"}/iep/[childId]` | `/iep/[childId]`;
            params: Router.UnknownOutputParams & { childId: string };
          }
        | {
            pathname: `${"/(parent)"}/milestones/[childId]` | `/milestones/[childId]`;
            params: Router.UnknownOutputParams & { childId: string };
          }
        | {
            pathname: `${"/(parent)"}/progress/[childId]` | `/progress/[childId]`;
            params: Router.UnknownOutputParams & { childId: string };
          }
        | {
            pathname: `${"/(parent)"}/session/[childId]` | `/session/[childId]`;
            params: Router.UnknownOutputParams & { childId: string };
          }
        | {
            pathname: `${"/(parent)"}/team/[childId]` | `/team/[childId]`;
            params: Router.UnknownOutputParams & { childId: string };
          }
        | {
            pathname: `${"/(teacher)"}/student/[id]/iep` | `/student/[id]/iep`;
            params: Router.UnknownOutputParams & { id: string };
          }
        | {
            pathname: `${"/(teacher)"}/student/[id]` | `/student/[id]`;
            params: Router.UnknownOutputParams & { id: string };
          }
        | {
            pathname: `${"/(teacher)"}/student/[id]/insight` | `/student/[id]/insight`;
            params: Router.UnknownOutputParams & { id: string };
          }
        | {
            pathname: `${"/(therapist)"}/client/[id]/goals` | `/client/[id]/goals`;
            params: Router.UnknownOutputParams & { id: string };
          }
        | {
            pathname: `${"/(therapist)"}/client/[id]` | `/client/[id]`;
            params: Router.UnknownOutputParams & { id: string };
          }
        | {
            pathname: `${"/(therapist)"}/client/[id]/notes` | `/client/[id]/notes`;
            params: Router.UnknownOutputParams & { id: string };
          }
        | {
            pathname: `${"/(therapist)"}/client/[id]/reports` | `/client/[id]/reports`;
            params: Router.UnknownOutputParams & { id: string };
          };
      href:
        | Router.RelativePathString
        | Router.ExternalPathString
        | `/accept-invite${`?${string}` | `#${string}` | ""}`
        | `/${`?${string}` | `#${string}` | ""}`
        | `/../../../packages/mobile-ui/src/shell/types${`?${string}` | `#${string}` | ""}`
        | `/../../../packages/mobile-ui/src/shell/RoleAwareTabBar${`?${string}` | `#${string}` | ""}`
        | `/../../../packages/mobile-ui/src/shell/RoleSwitcherSheet${`?${string}` | `#${string}` | ""}`
        | `/../../../packages/mobile-ui/src/shell/LockedScreenMobile${`?${string}` | `#${string}` | ""}`
        | `/../../../packages/mobile-ui/src/shell/index${`?${string}` | `#${string}` | ""}`
        | `${"/(shell-demo)"}/index${`?${string}` | `#${string}` | ""}`
        | `/index${`?${string}` | `#${string}` | ""}`
        | `${"/(auth)"}/consent-sheet${`?${string}` | `#${string}` | ""}`
        | `/consent-sheet${`?${string}` | `#${string}` | ""}`
        | `${"/(auth)"}/biometric-setup${`?${string}` | `#${string}` | ""}`
        | `/biometric-setup${`?${string}` | `#${string}` | ""}`
        | `${"/(auth)"}/session-switch${`?${string}` | `#${string}` | ""}`
        | `/session-switch${`?${string}` | `#${string}` | ""}`
        | `${"/(parent)"}/home-v2${`?${string}` | `#${string}` | ""}`
        | `/home-v2${`?${string}` | `#${string}` | ""}`
        | `/_sitemap${`?${string}` | `#${string}` | ""}`
        | `${"/(auth)"}/change-password${`?${string}` | `#${string}` | ""}`
        | `/change-password${`?${string}` | `#${string}` | ""}`
        | `${"/(auth)"}/forgot-password${`?${string}` | `#${string}` | ""}`
        | `/forgot-password${`?${string}` | `#${string}` | ""}`
        | `${"/(auth)"}/login${`?${string}` | `#${string}` | ""}`
        | `/login${`?${string}` | `#${string}` | ""}`
        | `${"/(auth)"}/pin${`?${string}` | `#${string}` | ""}`
        | `/pin${`?${string}` | `#${string}` | ""}`
        | `${"/(auth)"}/reset-password${`?${string}` | `#${string}` | ""}`
        | `/reset-password${`?${string}` | `#${string}` | ""}`
        | `${"/(auth)"}/signup${`?${string}` | `#${string}` | ""}`
        | `/signup${`?${string}` | `#${string}` | ""}`
        | `${"/(auth)"}/verify-mfa${`?${string}` | `#${string}` | ""}`
        | `/verify-mfa${`?${string}` | `#${string}` | ""}`
        | `${"/(caregiver)"}${`?${string}` | `#${string}` | ""}`
        | `/${`?${string}` | `#${string}` | ""}`
        | `${"/(caregiver)"}/notifications${`?${string}` | `#${string}` | ""}`
        | `/notifications${`?${string}` | `#${string}` | ""}`
        | `${"/(caregiver)"}/settings${`?${string}` | `#${string}` | ""}`
        | `/settings${`?${string}` | `#${string}` | ""}`
        | `${"/(learner)"}/adventure${`?${string}` | `#${string}` | ""}`
        | `/adventure${`?${string}` | `#${string}` | ""}`
        | `${"/(learner)"}/badges${`?${string}` | `#${string}` | ""}`
        | `/badges${`?${string}` | `#${string}` | ""}`
        | `${"/(learner)"}/brain${`?${string}` | `#${string}` | ""}`
        | `/brain${`?${string}` | `#${string}` | ""}`
        | `${"/(learner)"}/challenges${`?${string}` | `#${string}` | ""}`
        | `/challenges${`?${string}` | `#${string}` | ""}`
        | `${"/(learner)"}/gamification${`?${string}` | `#${string}` | ""}`
        | `/gamification${`?${string}` | `#${string}` | ""}`
        | `${"/(learner)"}/gradebook${`?${string}` | `#${string}` | ""}`
        | `/gradebook${`?${string}` | `#${string}` | ""}`
        | `${"/(learner)"}${`?${string}` | `#${string}` | ""}`
        | `/${`?${string}` | `#${string}` | ""}`
        | `${"/(learner)"}/leaderboard${`?${string}` | `#${string}` | ""}`
        | `/leaderboard${`?${string}` | `#${string}` | ""}`
        | `${"/(learner)"}/settings${`?${string}` | `#${string}` | ""}`
        | `/settings${`?${string}` | `#${string}` | ""}`
        | `${"/(learner)"}/shop${`?${string}` | `#${string}` | ""}`
        | `/shop${`?${string}` | `#${string}` | ""}`
        | `${"/(learner)"}/homework${`?${string}` | `#${string}` | ""}`
        | `/homework${`?${string}` | `#${string}` | ""}`
        | `${"/(learner)"}/quests${`?${string}` | `#${string}` | ""}`
        | `/quests${`?${string}` | `#${string}` | ""}`
        | `${"/(parent)"}/billing${`?${string}` | `#${string}` | ""}`
        | `/billing${`?${string}` | `#${string}` | ""}`
        | `${"/(parent)"}/inbox${`?${string}` | `#${string}` | ""}`
        | `/inbox${`?${string}` | `#${string}` | ""}`
        | `${"/(parent)"}${`?${string}` | `#${string}` | ""}`
        | `/${`?${string}` | `#${string}` | ""}`
        | `${"/(parent)"}/onboard${`?${string}` | `#${string}` | ""}`
        | `/onboard${`?${string}` | `#${string}` | ""}`
        | `${"/(parent)"}/recommendations${`?${string}` | `#${string}` | ""}`
        | `/recommendations${`?${string}` | `#${string}` | ""}`
        | `${"/(parent)"}/settings${`?${string}` | `#${string}` | ""}`
        | `/settings${`?${string}` | `#${string}` | ""}`
        | `${"/(parent)"}/tutors${`?${string}` | `#${string}` | ""}`
        | `/tutors${`?${string}` | `#${string}` | ""}`
        | `${"/(teacher)"}/analytics${`?${string}` | `#${string}` | ""}`
        | `/analytics${`?${string}` | `#${string}` | ""}`
        | `${"/(teacher)"}${`?${string}` | `#${string}` | ""}`
        | `/${`?${string}` | `#${string}` | ""}`
        | `${"/(teacher)"}/lesson-plan${`?${string}` | `#${string}` | ""}`
        | `/lesson-plan${`?${string}` | `#${string}` | ""}`
        | `${"/(teacher)"}/settings${`?${string}` | `#${string}` | ""}`
        | `/settings${`?${string}` | `#${string}` | ""}`
        | `${"/(therapist)"}${`?${string}` | `#${string}` | ""}`
        | `/${`?${string}` | `#${string}` | ""}`
        | `${"/(therapist)"}/sessions${`?${string}` | `#${string}` | ""}`
        | `/sessions${`?${string}` | `#${string}` | ""}`
        | `${"/(therapist)"}/settings${`?${string}` | `#${string}` | ""}`
        | `/settings${`?${string}` | `#${string}` | ""}`
        | { pathname: Router.RelativePathString; params?: Router.UnknownInputParams }
        | { pathname: Router.ExternalPathString; params?: Router.UnknownInputParams }
        | { pathname: `/accept-invite`; params?: Router.UnknownInputParams }
        | { pathname: `/`; params?: Router.UnknownInputParams }
        | {
            pathname: `/../../../packages/mobile-ui/src/shell/types`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../../packages/mobile-ui/src/shell/RoleAwareTabBar`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../../packages/mobile-ui/src/shell/RoleSwitcherSheet`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../../packages/mobile-ui/src/shell/LockedScreenMobile`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `/../../../packages/mobile-ui/src/shell/index`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `${"/(shell-demo)"}/index` | `/index`; params?: Router.UnknownInputParams }
        | {
            pathname: `${"/(auth)"}/consent-sheet` | `/consent-sheet`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${"/(auth)"}/biometric-setup` | `/biometric-setup`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${"/(auth)"}/session-switch` | `/session-switch`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `${"/(parent)"}/home-v2` | `/home-v2`; params?: Router.UnknownInputParams }
        | { pathname: `/_sitemap`; params?: Router.UnknownInputParams }
        | {
            pathname: `${"/(auth)"}/change-password` | `/change-password`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${"/(auth)"}/forgot-password` | `/forgot-password`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `${"/(auth)"}/login` | `/login`; params?: Router.UnknownInputParams }
        | { pathname: `${"/(auth)"}/pin` | `/pin`; params?: Router.UnknownInputParams }
        | {
            pathname: `${"/(auth)"}/reset-password` | `/reset-password`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `${"/(auth)"}/signup` | `/signup`; params?: Router.UnknownInputParams }
        | {
            pathname: `${"/(auth)"}/verify-mfa` | `/verify-mfa`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `${"/(caregiver)"}` | `/`; params?: Router.UnknownInputParams }
        | {
            pathname: `${"/(caregiver)"}/notifications` | `/notifications`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${"/(caregiver)"}/settings` | `/settings`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${"/(learner)"}/adventure` | `/adventure`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `${"/(learner)"}/badges` | `/badges`; params?: Router.UnknownInputParams }
        | { pathname: `${"/(learner)"}/brain` | `/brain`; params?: Router.UnknownInputParams }
        | {
            pathname: `${"/(learner)"}/challenges` | `/challenges`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${"/(learner)"}/gamification` | `/gamification`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${"/(learner)"}/gradebook` | `/gradebook`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `${"/(learner)"}` | `/`; params?: Router.UnknownInputParams }
        | {
            pathname: `${"/(learner)"}/leaderboard` | `/leaderboard`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `${"/(learner)"}/settings` | `/settings`; params?: Router.UnknownInputParams }
        | { pathname: `${"/(learner)"}/shop` | `/shop`; params?: Router.UnknownInputParams }
        | { pathname: `${"/(learner)"}/homework` | `/homework`; params?: Router.UnknownInputParams }
        | { pathname: `${"/(learner)"}/quests` | `/quests`; params?: Router.UnknownInputParams }
        | { pathname: `${"/(parent)"}/billing` | `/billing`; params?: Router.UnknownInputParams }
        | { pathname: `${"/(parent)"}/inbox` | `/inbox`; params?: Router.UnknownInputParams }
        | { pathname: `${"/(parent)"}` | `/`; params?: Router.UnknownInputParams }
        | { pathname: `${"/(parent)"}/onboard` | `/onboard`; params?: Router.UnknownInputParams }
        | {
            pathname: `${"/(parent)"}/recommendations` | `/recommendations`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `${"/(parent)"}/settings` | `/settings`; params?: Router.UnknownInputParams }
        | { pathname: `${"/(parent)"}/tutors` | `/tutors`; params?: Router.UnknownInputParams }
        | {
            pathname: `${"/(teacher)"}/analytics` | `/analytics`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `${"/(teacher)"}` | `/`; params?: Router.UnknownInputParams }
        | {
            pathname: `${"/(teacher)"}/lesson-plan` | `/lesson-plan`;
            params?: Router.UnknownInputParams;
          }
        | { pathname: `${"/(teacher)"}/settings` | `/settings`; params?: Router.UnknownInputParams }
        | { pathname: `${"/(therapist)"}` | `/`; params?: Router.UnknownInputParams }
        | {
            pathname: `${"/(therapist)"}/sessions` | `/sessions`;
            params?: Router.UnknownInputParams;
          }
        | {
            pathname: `${"/(therapist)"}/settings` | `/settings`;
            params?: Router.UnknownInputParams;
          }
        | `${"/(caregiver)"}/child/${Router.SingleRoutePart<T>}/accommodations${`?${string}` | `#${string}` | ""}`
        | `/child/${Router.SingleRoutePart<T>}/accommodations${`?${string}` | `#${string}` | ""}`
        | `${"/(caregiver)"}/child/${Router.SingleRoutePart<T>}/brain${`?${string}` | `#${string}` | ""}`
        | `/child/${Router.SingleRoutePart<T>}/brain${`?${string}` | `#${string}` | ""}`
        | `${"/(caregiver)"}/child/${Router.SingleRoutePart<T>}/gradebook${`?${string}` | `#${string}` | ""}`
        | `/child/${Router.SingleRoutePart<T>}/gradebook${`?${string}` | `#${string}` | ""}`
        | `${"/(caregiver)"}/child/${Router.SingleRoutePart<T>}/iep-goals${`?${string}` | `#${string}` | ""}`
        | `/child/${Router.SingleRoutePart<T>}/iep-goals${`?${string}` | `#${string}` | ""}`
        | `${"/(caregiver)"}/child/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ""}`
        | `/child/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ""}`
        | `${"/(caregiver)"}/child/${Router.SingleRoutePart<T>}/observation${`?${string}` | `#${string}` | ""}`
        | `/child/${Router.SingleRoutePart<T>}/observation${`?${string}` | `#${string}` | ""}`
        | `${"/(caregiver)"}/child/${Router.SingleRoutePart<T>}/progress${`?${string}` | `#${string}` | ""}`
        | `/child/${Router.SingleRoutePart<T>}/progress${`?${string}` | `#${string}` | ""}`
        | `${"/(caregiver)"}/child/${Router.SingleRoutePart<T>}/sessions${`?${string}` | `#${string}` | ""}`
        | `/child/${Router.SingleRoutePart<T>}/sessions${`?${string}` | `#${string}` | ""}`
        | `${"/(learner)"}/homework/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ""}`
        | `/homework/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ""}`
        | `${"/(learner)"}/quests/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ""}`
        | `/quests/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ""}`
        | `${"/(learner)"}/quests/${Router.SingleRoutePart<T>}/play/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ""}`
        | `/quests/${Router.SingleRoutePart<T>}/play/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ""}`
        | `${"/(learner)"}/stage/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ""}`
        | `/stage/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ""}`
        | `${"/(learner)"}/tutor/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ""}`
        | `/tutor/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ""}`
        | `${"/(parent)"}/brain/${Router.SingleRoutePart<T>}/history${`?${string}` | `#${string}` | ""}`
        | `/brain/${Router.SingleRoutePart<T>}/history${`?${string}` | `#${string}` | ""}`
        | `${"/(parent)"}/brain/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ""}`
        | `/brain/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ""}`
        | `${"/(parent)"}/brain/${Router.SingleRoutePart<T>}/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ""}`
        | `/brain/${Router.SingleRoutePart<T>}/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ""}`
        | `${"/(parent)"}/colearn/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ""}`
        | `/colearn/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ""}`
        | `${"/(parent)"}/iep/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ""}`
        | `/iep/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ""}`
        | `${"/(parent)"}/milestones/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ""}`
        | `/milestones/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ""}`
        | `${"/(parent)"}/progress/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ""}`
        | `/progress/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ""}`
        | `${"/(parent)"}/session/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ""}`
        | `/session/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ""}`
        | `${"/(parent)"}/team/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ""}`
        | `/team/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ""}`
        | `${"/(teacher)"}/student/${Router.SingleRoutePart<T>}/iep${`?${string}` | `#${string}` | ""}`
        | `/student/${Router.SingleRoutePart<T>}/iep${`?${string}` | `#${string}` | ""}`
        | `${"/(teacher)"}/student/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ""}`
        | `/student/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ""}`
        | `${"/(teacher)"}/student/${Router.SingleRoutePart<T>}/insight${`?${string}` | `#${string}` | ""}`
        | `/student/${Router.SingleRoutePart<T>}/insight${`?${string}` | `#${string}` | ""}`
        | `${"/(therapist)"}/client/${Router.SingleRoutePart<T>}/goals${`?${string}` | `#${string}` | ""}`
        | `/client/${Router.SingleRoutePart<T>}/goals${`?${string}` | `#${string}` | ""}`
        | `${"/(therapist)"}/client/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ""}`
        | `/client/${Router.SingleRoutePart<T>}${`?${string}` | `#${string}` | ""}`
        | `${"/(therapist)"}/client/${Router.SingleRoutePart<T>}/notes${`?${string}` | `#${string}` | ""}`
        | `/client/${Router.SingleRoutePart<T>}/notes${`?${string}` | `#${string}` | ""}`
        | `${"/(therapist)"}/client/${Router.SingleRoutePart<T>}/reports${`?${string}` | `#${string}` | ""}`
        | `/client/${Router.SingleRoutePart<T>}/reports${`?${string}` | `#${string}` | ""}`
        | {
            pathname:
              | `${"/(caregiver)"}/child/[childId]/accommodations`
              | `/child/[childId]/accommodations`;
            params: Router.UnknownInputParams & { childId: string | number };
          }
        | {
            pathname: `${"/(caregiver)"}/child/[childId]/brain` | `/child/[childId]/brain`;
            params: Router.UnknownInputParams & { childId: string | number };
          }
        | {
            pathname: `${"/(caregiver)"}/child/[childId]/gradebook` | `/child/[childId]/gradebook`;
            params: Router.UnknownInputParams & { childId: string | number };
          }
        | {
            pathname: `${"/(caregiver)"}/child/[childId]/iep-goals` | `/child/[childId]/iep-goals`;
            params: Router.UnknownInputParams & { childId: string | number };
          }
        | {
            pathname: `${"/(caregiver)"}/child/[childId]` | `/child/[childId]`;
            params: Router.UnknownInputParams & { childId: string | number };
          }
        | {
            pathname:
              | `${"/(caregiver)"}/child/[childId]/observation`
              | `/child/[childId]/observation`;
            params: Router.UnknownInputParams & { childId: string | number };
          }
        | {
            pathname: `${"/(caregiver)"}/child/[childId]/progress` | `/child/[childId]/progress`;
            params: Router.UnknownInputParams & { childId: string | number };
          }
        | {
            pathname: `${"/(caregiver)"}/child/[childId]/sessions` | `/child/[childId]/sessions`;
            params: Router.UnknownInputParams & { childId: string | number };
          }
        | {
            pathname: `${"/(learner)"}/homework/[sessionId]` | `/homework/[sessionId]`;
            params: Router.UnknownInputParams & { sessionId: string | number };
          }
        | {
            pathname: `${"/(learner)"}/quests/[worldSlug]` | `/quests/[worldSlug]`;
            params: Router.UnknownInputParams & { worldSlug: string | number };
          }
        | {
            pathname:
              | `${"/(learner)"}/quests/[worldSlug]/play/[questId]`
              | `/quests/[worldSlug]/play/[questId]`;
            params: Router.UnknownInputParams & {
              worldSlug: string | number;
              questId: string | number;
            };
          }
        | {
            pathname: `${"/(learner)"}/stage/[sessionId]` | `/stage/[sessionId]`;
            params: Router.UnknownInputParams & { sessionId: string | number };
          }
        | {
            pathname: `${"/(learner)"}/tutor/[tutorSlug]` | `/tutor/[tutorSlug]`;
            params: Router.UnknownInputParams & { tutorSlug: string | number };
          }
        | {
            pathname: `${"/(parent)"}/brain/[childId]/history` | `/brain/[childId]/history`;
            params: Router.UnknownInputParams & { childId: string | number };
          }
        | {
            pathname: `${"/(parent)"}/brain/[childId]` | `/brain/[childId]`;
            params: Router.UnknownInputParams & { childId: string | number };
          }
        | {
            pathname: `${"/(parent)"}/brain/[childId]/[domain]` | `/brain/[childId]/[domain]`;
            params: Router.UnknownInputParams & {
              childId: string | number;
              domain: string | number;
            };
          }
        | {
            pathname: `${"/(parent)"}/colearn/[childId]` | `/colearn/[childId]`;
            params: Router.UnknownInputParams & { childId: string | number };
          }
        | {
            pathname: `${"/(parent)"}/iep/[childId]` | `/iep/[childId]`;
            params: Router.UnknownInputParams & { childId: string | number };
          }
        | {
            pathname: `${"/(parent)"}/milestones/[childId]` | `/milestones/[childId]`;
            params: Router.UnknownInputParams & { childId: string | number };
          }
        | {
            pathname: `${"/(parent)"}/progress/[childId]` | `/progress/[childId]`;
            params: Router.UnknownInputParams & { childId: string | number };
          }
        | {
            pathname: `${"/(parent)"}/session/[childId]` | `/session/[childId]`;
            params: Router.UnknownInputParams & { childId: string | number };
          }
        | {
            pathname: `${"/(parent)"}/team/[childId]` | `/team/[childId]`;
            params: Router.UnknownInputParams & { childId: string | number };
          }
        | {
            pathname: `${"/(teacher)"}/student/[id]/iep` | `/student/[id]/iep`;
            params: Router.UnknownInputParams & { id: string | number };
          }
        | {
            pathname: `${"/(teacher)"}/student/[id]` | `/student/[id]`;
            params: Router.UnknownInputParams & { id: string | number };
          }
        | {
            pathname: `${"/(teacher)"}/student/[id]/insight` | `/student/[id]/insight`;
            params: Router.UnknownInputParams & { id: string | number };
          }
        | {
            pathname: `${"/(therapist)"}/client/[id]/goals` | `/client/[id]/goals`;
            params: Router.UnknownInputParams & { id: string | number };
          }
        | {
            pathname: `${"/(therapist)"}/client/[id]` | `/client/[id]`;
            params: Router.UnknownInputParams & { id: string | number };
          }
        | {
            pathname: `${"/(therapist)"}/client/[id]/notes` | `/client/[id]/notes`;
            params: Router.UnknownInputParams & { id: string | number };
          }
        | {
            pathname: `${"/(therapist)"}/client/[id]/reports` | `/client/[id]/reports`;
            params: Router.UnknownInputParams & { id: string | number };
          };
    }
  }
}
