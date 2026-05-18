# AIVO Learning — React Native Mobile App Build Specification

## What You Are Building

A React Native (Expo) mobile app at `apps/mobile` inside the existing AIVO pnpm + Turborepo monorepo. The app achieves full feature parity with the React 19 + Next.js 15 web app at `apps/web` across 5 user roles: Parent, Learner, Teacher, Caregiver, and Therapist. Platform Admin and District Admin are web-only roles. The app shares TypeScript types, API clients, event schemas, business logic, and design tokens directly from the monorepo's 14 shared packages. The learner experience is built on a GPU-accelerated Stage renderer using `@shopify/react-native-skia`, not a chat interface and not a WebView.

---

## The Monorepo Context

The existing monorepo is 72% TypeScript with:

- 13 TypeScript microservices (Fastify) + 2 Python microservices (FastAPI)
- A React 19 + Next.js 15 web app at `apps/web` with TailwindCSS 4 and shadcn/ui
- 14 shared packages in `packages/`
- pnpm workspaces + Turborepo for builds
- NATS JetStream event bus, PostgreSQL 16 with RLS, Redis 7

The mobile app plugs into this monorepo as another `apps/` entry. It does not duplicate types, clients, or business logic. It imports them.

---

## Technical Stack

| Layer          | Technology                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------- |
| Framework      | Expo SDK 52+ (managed workflow)                                                              |
| Navigation     | Expo Router (file-based, mirrors Next.js routing)                                            |
| Server State   | TanStack Query v5 (caching, background refetch, offline)                                     |
| Local State    | Zustand (UI state, auth state, sensory profile context)                                      |
| HTTP Clients   | `@aivo/brain-client`, `@aivo/ai-client`, `@aivo/tutor-client` (direct monorepo import)       |
| Streaming      | `react-native-sse` polyfill (SSE for tutor sessions)                                         |
| GPU Rendering  | `@shopify/react-native-skia` (Stage canvas, Brain visualization)                             |
| Animations     | `react-native-reanimated` v3 (UI thread worklets) + `lottie-react-native` (tutor characters) |
| Gestures       | `react-native-gesture-handler` (drag-and-drop, swipe, pan)                                   |
| Haptics        | `expo-haptics` (correct/incorrect feedback, drag snap, celebrations)                         |
| Audio          | `expo-av` (TTS playback, sound effects, ambient) + `expo-speech` (fallback TTS)              |
| Camera         | `expo-camera` + `expo-image-picker` (homework capture, IEP photo)                            |
| Files          | `expo-file-system` + `expo-document-picker` (PDF upload)                                     |
| Offline DB     | `expo-sqlite` (Brain cache, lesson cache, sync queue)                                        |
| Secure Storage | `expo-secure-store` (JWT, refresh tokens, learner PIN)                                       |
| Push           | `expo-notifications` + FCM (Android) + APNs (iOS)                                            |
| Biometrics     | `expo-local-authentication` (Face ID / Touch ID for parent)                                  |
| i18n           | `i18next` + `react-i18next` (19 namespaces, ~2050 keys, matches web)                         |
| Design Tokens  | `@aivo/brand` (direct import, same tokens as web)                                            |
| Testing        | Jest + React Native Testing Library (unit/component) + Detox (E2E)                           |
| OTA Updates    | EAS Update (channels: production, staging, preview)                                          |

---

## Package Sharing

### Direct Imports (Zero Changes)

These packages are pure TypeScript with no DOM or Node dependencies. Import them in the mobile app exactly as the web app does via `workspace:*` in `package.json`:

| Package                    | What It Provides                                                     |
| -------------------------- | -------------------------------------------------------------------- |
| `@aivo/brand`              | Color tokens (purple, teal, navy), gradients, fonts, radius, shadows |
| `@aivo/events`             | Zod-typed NATS event definitions (all event payloads as TS types)    |
| `@aivo/brain-client`       | Type-safe HTTP client for brain-svc (uses fetch, works in RN)        |
| `@aivo/ai-client`          | Type-safe HTTP client for ai-svc (uses fetch)                        |
| `@aivo/tutor-client`       | Type-safe HTTP client for tutor-svc (uses fetch)                     |
| `@aivo/auth`               | JWT decode, role enums, guard logic, session types                   |
| `@aivo/feature-flags`      | Feature flag client (uses fetch)                                     |
| `@aivo/iep-parser`         | IEP document parsing type definitions                                |
| `@aivo/functioning-levels` | Functioning level enum, routing logic, content generation rules      |

### New Package: @aivo/mobile-ui

Create `packages/mobile-ui`. This package provides React Native components that implement the same visual language as the web `@aivo/ui` components but using RN primitives (`View`, `Text`, `Pressable`) instead of DOM elements (`div`, `span`, `button`). It imports `@aivo/brand` tokens directly for all colors, spacing, radius, and shadows.

### Not Used on Mobile

| Package                                | Why                                                                 |
| -------------------------------------- | ------------------------------------------------------------------- |
| `@aivo/ui`                             | React DOM components, cannot render in RN                           |
| `@aivo/security`                       | CSRF not applicable (token auth only), rate limiting is server-side |
| `@aivo/db`                             | Type exports importable, but no Drizzle DB connection on mobile     |
| `@aivo/nats`                           | No direct NATS connection from mobile, events consumed via API      |
| `@enterprise-email/aivolearning-email` | Email sent server-side only                                         |

---

## Directory Structure

```
apps/mobile/
  app.json                          # Expo config
  app/                              # Expo Router file-based routes
    _layout.tsx                     # Root layout (auth check, font loading, providers)
    index.tsx                       # Entry redirect based on auth/role
    (auth)/
      login.tsx                     # Parent email/password + OAuth
      pin.tsx                       # Learner PIN pad
      signup.tsx                    # Parent registration + COPPA consent
      forgot-password.tsx
    (parent)/
      _layout.tsx                   # Parent bottom tab navigator
      index.tsx                     # Dashboard home
      brain/[childId]/
        index.tsx                   # Brain cross-section with grade ladders
        [domain].tsx                # Domain drill-down (ladder, sessions, trend)
        history.tsx                 # Version timeline, rollback
      recommendations.tsx           # Recommendation inbox
      iep/[childId].tsx             # IEP upload, goals, progress, report generation
      progress/[childId].tsx        # Domain charts, session history, engagement
      tutors.tsx                    # Tutor store (browse, subscribe, manage)
      session/[childId].tsx         # Co-view of child's active Stage session
      colearn/[childId].tsx         # Parent co-learning mode
      onboard.tsx                   # Add child: assessment, IEP, Building Sequence, approve
      team/[childId].tsx            # Care team management
      billing.tsx                   # Stripe subscription, invoices
      settings.tsx                  # Account, notifications, data export/delete
    (learner)/
      _layout.tsx                   # Learner tab navigator (World Map, Brain, Shop, Profile)
      index.tsx                     # World Map home (quest worlds, avatar, streak, daily challenge)
      stage/[sessionId].tsx         # The Stage (full-screen Skia learning session)
      adventure.tsx                 # Discovery Adventure (baseline assessment)
      tutor/[tutorSlug].tsx         # Tutor session (SSE streaming on Stage)
      homework.tsx                  # Camera capture, upload, adapted session
      brain.tsx                     # Child-friendly Brain explorer with grade ladders
      gamification.tsx              # XP, streak, challenges, leaderboard preview
      shop.tsx                      # Avatar customization, item purchase
      quests.tsx                    # Quest world map, chapter progression
      challenges.tsx                # Multiplayer quiz battles, tournaments
      badges.tsx                    # Badge cabinet with rarity display
      gradebook.tsx                 # Subject mastery bars, session history
    (teacher)/
      _layout.tsx                   # Teacher tab navigator
      index.tsx                     # Classroom dashboard, at-risk indicators
      student/[id]/
        index.tsx                   # Read-only Brain profile with grade ladders
        insight.tsx                 # Submit Brain insight
        iep.tsx                     # Upload IEP on behalf of parent
      lesson-plan.tsx               # Brain-informed lesson plan generator
      analytics.tsx                 # Class-level functioning level distribution, progress
    (caregiver)/
      _layout.tsx                   # Caregiver tab navigator (Home, Children, Activity)
      index.tsx                     # Dashboard: assigned children, recent activity, upcoming sessions
      child/[childId]/
        index.tsx                   # Child overview: Brain summary, today's sessions, streak
        brain.tsx                   # Read-only summary-level Brain view with grade ladders
        accommodations.tsx          # Active accommodations list with explanations
        iep-goals.tsx               # IEP goal progress (read-only, visual progress bars)
        gradebook.tsx               # Subject mastery bars, session history (read-only)
        sessions.tsx                # Session log: dates, subjects, duration, tutor used
        observation.tsx             # Submit observational notes (text + voice input)
        progress.tsx                # Trend charts: delivery level over time per domain
      notifications.tsx             # Alerts: IEP goal met, functioning level change, streak milestones
      settings.tsx                  # Account, notification preferences
    (therapist)/
      _layout.tsx
      index.tsx                     # Client list, Brain summary per client
      client/[id]/
        index.tsx                   # HIPAA-scoped read-only Brain profile
        goals.tsx                   # Therapy goal alignment with Brain/IEP goals
        notes.tsx                   # Session notes that feed Brain insight layer
        reports.tsx                 # Insurance documentation formatted reports
  components/
    stage/
      StageRenderer.tsx             # Skia canvas controller
      SensoryAdapter.tsx            # Context provider, filters all rendering by sensory profile
      ResponseZone.tsx              # Morphing response area (tap, drag, speak, draw, yesno)
      AnswerCard.tsx                # Large touchable answer option with haptic
      DragTarget.tsx                # Gesture handler drop zone with snap
      MicButton.tsx                 # Voice input with pulsing ring animation
      DrawCanvas.tsx                # Skia drawing surface for writing/drawing responses
      BeatRunner.tsx                # Consumes JSON beat format, orchestrates scene
    brain/
      BrainVisualization.tsx        # Skia cross-section with compartments
      GradeLadder.tsx               # Skia vertical ladder with animated marker
      AccommodationRing.tsx         # Circular card layout around brain
      GoalPath.tsx                  # Stepping stones with IEP star pins
      BuildingSequence.tsx          # 6-stage clone animation for parent onboarding
    tutors/
      TutorCharacter.tsx            # Lottie renderer with state machine
      TutorSessionView.tsx          # SSE consumer + Stage renderer + tutor character
      TutorStore.tsx                # Browse/subscribe/manage tutors
    gamification/
      XPBar.tsx                     # Animated progress bar
      StreakFlame.tsx                # Lottie flame with day count
      BadgeIcon.tsx                 # Rarity-bordered badge with sparkle
      QuestWorldMap.tsx             # Illustrated world map with chapter markers
      ChallengeCard.tsx             # Daily/multiplayer challenge card
      AvatarEditor.tsx              # Avatar customization with shop items
      LeaderboardList.tsx           # Ranked list with XP/level display
    assessment/
      DiscoveryAdventure.tsx        # 6-chapter baseline assessment orchestrator
      AdaptiveEngine.tsx            # CAT item selection, implicit signal collection
      ChapterRenderer.tsx           # Per-chapter Stage scene (Sage's Garden, Nova's Galaxy, etc.)
    shared/
      AivoButton.tsx
      AivoCard.tsx
      AivoHeader.tsx                # Purple gradient header (expo-linear-gradient)
      StatCard.tsx
      EmptyState.tsx
      LoadingState.tsx
      ErrorBoundary.tsx
  hooks/
    useAuth.ts                      # Auth state, login/logout, role detection
    useBrain.ts                     # Brain context fetch, cache, offline fallback
    useTutor.ts                     # Tutor session management, SSE connection
    useSensory.ts                   # Sensory profile context consumer
    useOffline.ts                   # Network state, sync queue management
    useHaptic.ts                    # Sensory-aware haptic wrapper
    useAudio.ts                     # Sensory-aware audio playback wrapper
  lib/
    offline.ts                      # SQLite schema, sync queue, drain logic
    sensory.ts                      # SensoryAdapter filter functions
    audio.ts                        # Audio asset management, TTS, sound effects
    haptics.ts                      # Haptic pattern definitions per interaction type
    notifications.ts                # Push registration, deep link handling
    analytics.ts                    # Event tracking (Sentry RN SDK)
  assets/
    tutors/                         # Lottie JSON per tutor (14 tutors, ~300KB each)
    sounds/                         # Sound effects (celebration, hint, transition, ambient)
    fonts/                          # Nunito family, JetBrains Mono
    images/                         # Onboarding illustrations, empty states
```

---

## Screen Map by Role

### Parent Screens (14 screens)

| Screen                  | Route                                | Key Features                                                                                                                       |
| ----------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard Home          | `/(parent)/`                         | Child cards with Brain summary, quick stats per child, recommendation count badges, streak indicators                              |
| Brain Profile           | `/(parent)/brain/[childId]`          | Interactive Skia Brain cross-section with grade ladders per domain, accommodation ring, goal paths                                 |
| Brain Domain Drill-Down | `/(parent)/brain/[childId]/[domain]` | Full-size grade ladder, stepping stones with skill labels, session history, tutor performance, trend chart                         |
| Brain Version History   | `/(parent)/brain/[childId]/history`  | Version timeline, snapshot comparison, rollback to any previous state                                                              |
| Recommendation Inbox    | `/(parent)/recommendations`          | APPROVE / DECLINE / ADD CONTEXT per recommendation, filterable by child and type                                                   |
| IEP Management          | `/(parent)/iep/[childId]`            | Upload (camera + PDF), parsed goals display, per-goal progress bars, "Generate IEP Report" PDF                                     |
| Progress Dashboard      | `/(parent)/progress/[childId]`       | Domain mastery trend charts, session frequency, tutor usage stats, engagement metrics                                              |
| Tutor Store             | `/(parent)/tutors`                   | Browse all 14 tutors, persona previews, subscribe individually or by bundle (Core 7, Subject Packs, Full 14), manage active tutors |
| Co-View Session         | `/(parent)/session/[childId]`        | Real-time view of child's active Stage session                                                                                     |
| Parent Co-Learning      | `/(parent)/colearn/[childId]`        | Join tutor session alongside child, receive real-time coaching notes                                                               |
| Add Child (Onboarding)  | `/(parent)/onboard`                  | Parent assessment, IEP upload, functioning level routing, Building Sequence (6 stages), approve/context/deny                       |
| Care Team               | `/(parent)/team/[childId]`           | Invite/manage teacher (1 slot), caregivers (2 slots), therapist. View pending invites.                                             |
| Billing                 | `/(parent)/billing`                  | Stripe subscription management, plan tier, tutor add-ons, invoices, payment method                                                 |
| Settings                | `/(parent)/settings`                 | Account, notifications, data export (GDPR ZIP), data deletion, child PIN management                                                |

### Learner Screens (12 screens)

| Screen                 | Route                          | Key Features                                                                                                                                |
| ---------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| World Map Home         | `/(learner)/`                  | Quest worlds (up to 14, one per subscribed tutor), avatar display, streak flame, XP bar, daily challenge card, quick-start tutor buttons    |
| The Stage              | `/(learner)/stage/[sessionId]` | Full-screen Skia canvas. Tutor character, visual content, Response Zone. All functioning-level adaptations. SensoryAdapter active. Haptics. |
| Discovery Adventure    | `/(learner)/adventure`         | Baseline assessment as 6-chapter adventure. Skia Stage with adaptive engine.                                                                |
| Tutor Session          | `/(learner)/tutor/[tutorSlug]` | Any of 14 tutors. SSE streaming rendered on Stage. Tutor character animations, visual content, Socratic interaction.                        |
| Homework Helper        | `/(learner)/homework`          | Camera capture, gallery, PDF. OCR processing animation. Adapted homework view. Interactive session with subscribed tutor.                   |
| Brain Explorer         | `/(learner)/brain`             | Child-friendly Brain cross-section with grade ladders. Tutor narrates on first view. Progress markers climb after sessions.                 |
| Gamification Dashboard | `/(learner)/gamification`      | XP card, streak flame, active challenges, leaderboard preview, badge count                                                                  |
| Avatar & Shop          | `/(learner)/shop`              | Avatar customization, 50+ items across 6 categories, rarity tiers, coin/gem purchase, grade-band filtering                                  |
| Quest Map              | `/(learner)/quests`            | Up to 14 quest worlds (one per tutor), chapter progression, boss battles, XP/coin rewards                                                   |
| Multiplayer            | `/(learner)/challenges`        | Quiz battles (1v1), team challenges, weekly tournaments, invite codes, real-time scoring                                                    |
| Badge Cabinet          | `/(learner)/badges`            | Visual badge display by rarity tier, celebration replay on tap, total count                                                                 |
| Gradebook              | `/(learner)/gradebook`         | Subject mastery bars per domain, session history with dates and skills practiced                                                            |

### Teacher Screens (6 screens)

| Screen                | Route                             | Key Features                                                                                     |
| --------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------ |
| Classroom Dashboard   | `/(teacher)/`                     | Class list, at-risk student indicators (regression, low engagement), overall domain progress     |
| Student Brain Profile | `/(teacher)/student/[id]`         | Read-only Brain with grade ladders, accommodations, IEP goals, functioning level                 |
| Submit Insight        | `/(teacher)/student/[id]/insight` | Text + voice input for Brain insights. Creates teacher_insight recommendation in parent inbox.   |
| Lesson Plan Generator | `/(teacher)/lesson-plan`          | Select students, auto-generate Brain-informed lesson plan with differentiated groups, PDF export |
| IEP Upload            | `/(teacher)/student/[id]/iep`     | Upload IEP on behalf of parent (stored as pending until parent confirms)                         |
| Class Analytics       | `/(teacher)/analytics`            | Functioning level distribution, domain progress heatmap, tutor usage, engagement trends          |

### Caregiver Screens (10 screens)

| Screen             | Route                                         | Key Features                                                                                                                                               |
| ------------------ | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard          | `/(caregiver)/`                               | Assigned children list, recent activity per child, upcoming session indicators, quick observation button                                                   |
| Child Overview     | `/(caregiver)/child/[childId]`                | Brain summary card, today's completed/upcoming sessions, current streak, active tutors                                                                     |
| Brain Summary      | `/(caregiver)/child/[childId]/brain`          | Read-only summary-level Brain view with grade ladders showing enrolled grade vs. functioning grade per domain                                              |
| Accommodations     | `/(caregiver)/child/[childId]/accommodations` | Full list of active accommodations with plain-language explanations of what each one means and why it is active                                            |
| IEP Goals          | `/(caregiver)/child/[childId]/iep-goals`      | Visual progress bars per IEP goal showing baseline, current, and target. Read-only.                                                                        |
| Gradebook          | `/(caregiver)/child/[childId]/gradebook`      | Subject mastery bars, session history with dates, skills practiced, and mastery changes                                                                    |
| Session Log        | `/(caregiver)/child/[childId]/sessions`       | Chronological session log: date, subject, tutor used, duration, skill focus, completion quality                                                            |
| Submit Observation | `/(caregiver)/child/[childId]/observation`    | Text input + voice recording for observational notes. Stored as caregiver insight in Brain. Prompts: "How did [name] do today?" "Anything we should know?" |
| Progress Trends    | `/(caregiver)/child/[childId]/progress`       | Trend charts showing delivery level movement per domain over time. Enrolled grade as target line.                                                          |
| Notifications      | `/(caregiver)/notifications`                  | Alerts for IEP goal milestones, functioning level changes, streak achievements, Brain updates                                                              |

### Therapist Screens (5 screens)

| Screen                       | Route                              | Key Features                                                                                                                           |
| ---------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Client Dashboard             | `/(therapist)/`                    | Client list (learners the therapist has been invited to), Brain summary per client, recent session activity                            |
| Brain Profile (HIPAA-Scoped) | `/(therapist)/client/[id]`         | Read-only Brain scoped to therapy-relevant domains. Grade ladders, accommodations, functioning level, sensory profile.                 |
| Therapy Goal Alignment       | `/(therapist)/client/[id]/goals`   | Align therapy goals with Brain/IEP goals. Create linked therapy goals. Track progress across both systems.                             |
| Session Notes                | `/(therapist)/client/[id]/notes`   | Submit therapy session notes that feed the Brain's insight layer. Structured fields: skill targeted, method, outcome, recommendations. |
| Progress Reports             | `/(therapist)/client/[id]/reports` | Generate insurance-documentation-formatted progress reports. CPT code aligned. PDF export.                                             |

---

## Authentication

### Parent Login

Email/password form or Google/Apple OAuth via `expo-auth-session`. On success, store JWT in `expo-secure-store` under key `aivo_access_token`, refresh token under `aivo_refresh_token`. Decode role from JWT payload. Navigate to `/(parent)/`. On subsequent launches, check stored token validity. If valid, skip login. If expired, attempt silent refresh via refresh token endpoint. If refresh fails, show login. Optional biometric unlock: after first successful login, offer "Enable Face ID / Touch ID." Store a biometric flag. On next launch, prompt biometric before reading stored token.

### Learner PIN Login

Full-screen PIN pad using the Stage visual language. AIVO warm purple background (#1A1A2E). Large circular number buttons (80px diameter, `@aivo/brand` purple fill, white text, Nunito ExtraBold). Haptic feedback on each tap (`expo-haptics` light impact). PIN displayed as filled dots (not numbers, for privacy). On correct PIN, the learner's avatar does a wave animation and the app navigates to `/(learner)/`. On incorrect PIN, buttons shake gently (Reanimated spring), dots turn red briefly, and a warm audio cue plays. After 5 failed attempts, show "Ask a parent for help." PIN is stored encrypted in `expo-secure-store`. No biometric for learner accounts (COPPA).

### Teacher / Caregiver / Therapist Login

Email/password or school SSO (Clever/ClassLink) via `expo-auth-session` custom scheme redirect. Same JWT storage pattern as parent. Role decoded from token determines which layout group loads.

### Role-Based Shell Routing

The root `_layout.tsx` reads the authenticated role and renders the appropriate layout group. Each group `(parent)`, `(learner)`, `(teacher)`, `(caregiver)`, `(therapist)` has its own `_layout.tsx` defining the bottom tab navigator with role-specific tabs, header configuration, and guard middleware that redirects if the user's role does not match. Platform Admin and District Admin roles are redirected to the web app.

### Token Refresh

A background interval (14 minutes) calls the refresh endpoint. If the app is backgrounded, the refresh runs on next foreground via `AppState` listener. All API calls via `@aivo/brain-client` and other shared clients include an auth interceptor that retries with a fresh token on 401.

---

## The Stage (Mobile-Native Renderer)

### Architecture

```
┌──────────────────────────────────────────┐
│ Top Bar (React Native View)              │
│ Brain indicator · progress path · pause  │
├──────────────────────────────────────────┤
│                                          │
│  @shopify/react-native-skia Canvas       │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ Background layer (Skia Image/Path) │  │
│  │ Content layer (illustrations,      │  │
│  │   manipulatives, grade ladders,    │  │
│  │   diagrams, text with highlights)  │  │
│  │ Particle layer (celebrations,      │  │
│  │   transitions, hints)              │  │
│  │ Tutor layer (Lottie character      │  │
│  │   positioned and state-driven)     │  │
│  └────────────────────────────────────┘  │
│                                          │
├──────────────────────────────────────────┤
│ Response Zone (React Native Views)       │
│ Morphs per question type:               │
│ · AnswerCards (tap) · DragTargets (drag) │
│ · MicButton (speak) · DrawCanvas (draw) │
│ · YesNo buttons · Help/Skip buttons     │
└──────────────────────────────────────────┘
```

The Skia canvas is the visual rendering engine. React Native Views overlaid on top handle touch interaction and accessibility. This split ensures: GPU-accelerated smooth visuals AND full VoiceOver/TalkBack accessibility on interactive elements.

### Beat Format (Shared with Web)

The Stage consumes the same JSON beat format that the web app uses. ai-svc generates beats. Both web (Pixi.js) and mobile (Skia) renderers interpret the same data:

```typescript
interface StageBeat {
  id: string;
  visual: {
    background: string;
    elements: StageElement[];
    tutorState: "idle" | "speaking" | "pointing" | "celebrating" | "thinking" | "encouraging";
    tutorTarget?: string;
  };
  audio: {
    narration: string;
    soundEffect?: string;
    ambient?: string;
  };
  interaction: {
    type: "tap" | "drag" | "speak" | "match" | "draw" | "yesno";
    options: InteractionOption[];
    correctIds: string[];
    hintAfter?: number;
  };
  sensory: {
    motionIntensity: number;
    visualComplexity: number;
    audioPriority: boolean;
  };
  adaptive: {
    nextOnCorrect: string;
    nextOnIncorrect: string;
    implicitSignals: string[];
  };
}
```

Import the beat type from a shared location (add to `@aivo/events` or create `@aivo/stage-types`). Both renderers consume it. Content is authored once.

### SensoryAdapter

A React context provider that wraps the Stage. On mount, fetches `sensoryProfile` from `@aivo/brain-client`. All child components read sensory parameters from context and adjust rendering:

- Visual hyper-sensitivity: Skia `ColorFilter.matrix()` desaturation at 30%, cap brightness, max 3 on-screen elements, soft shadows, animation durations doubled
- Visual hypo-sensitivity: contrast filter applied, bold outlines (stroke width 3), interactive elements pulse via Reanimated `withRepeat`
- Motion sensitivity: particle effects disabled, Reanimated durations set to 0 (instant), Lottie idle animations paused, slide transitions replaced with opacity fades
- Auditory hyper-sensitivity: `expo-av` volume at 60%, no sudden sound effects, gradual fades
- Auditory hypo-sensitivity: volume at 120%, secondary chime before instructions, slower speech rate
- Tactile off: all `expo-haptics` calls become no-ops
- Cognitive load high: fewer elements per screen, 10-second breathing animation between activities, simpler narration

### Tutor Characters

14 Lottie JSON files, one per tutor. Each file contains named animation segments: `idle`, `speaking`, `pointing_left`, `pointing_right`, `celebrating`, `thinking`, `encouraging`, `transitioning`. A `TutorStateMachine` class manages transitions:

```typescript
class TutorStateMachine {
  currentState: TutorAnimState;
  transition(to: TutorAnimState, target?: string): void;
  // Plays the Lottie segment for the new state
  // If 'pointing', positions the tutor's gesture toward the target element
}
```

Tutor assets are loaded lazily. Only the active session's tutor is loaded (~300KB). Pre-cache the learner's subscribed tutors on app install.

### Haptic Patterns

```typescript
// lib/haptics.ts
import * as Haptics from "expo-haptics";

export const haptic = {
  tap: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  dragSnap: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  correct: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  incorrect: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  celebrate: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  pinTap: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
};
// All calls filtered through useSensory() — if tactile === 'off', these become no-ops
```

### Functioning-Level Response Zone Adaptations

Import `@aivo/functioning-levels` for all rules:

| Level                | Response Zone Behavior                                                                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| STANDARD             | 4 answer cards (48px touch targets), drag-and-drop, voice, text input, drawing                                                                       |
| SUPPORTED            | 3 answer cards (56px), auto-play audio labels, 1.5x response timeout, larger drag targets                                                            |
| LOW_VERBAL           | 2 answer cards covering 40% of screen each, no text anywhere, audio-primary, touch-anywhere-to-select, celebration on every interaction              |
| NON_VERBAL (switch)  | 2 options highlight alternately via Reanimated withRepeat (configurable dwell 1.5-3s), iOS Switch Control / Android Switch Access triggers selection |
| NON_VERBAL (partner) | Facilitator overlay shows instructions, child screen shows 2 simplified visuals, facilitator taps response recording buttons                         |
| PRE_SYMBOLIC         | No Stage. Parent sees activity guides and observational checklists in their dashboard.                                                               |

---

## Brain Visualization (Skia)

The Brain cross-section, grade ladders, accommodation ring, goal paths, and Building Sequence are all rendered using `@shopify/react-native-skia`.

### Grade Ladder Component

A vertical Skia path with grade markers as small horizontal lines. The enrolled grade flag at the top. A colored fill from bottom to the child's current level (animated with Reanimated shared values driving Skia path clip). The marker glows at the current level. Stepping stones between current and target are drawn as small nodes on the path with skill labels rendered as Skia text.

After sessions, when mastery updates arrive, the marker position (a Reanimated shared value) animates upward to the new level. This animation is visible whenever the learner or parent views the Brain.

### Building Sequence (Parent Onboarding)

The 6-stage clone visualization plays on the parent's screen during onboarding. All 6 stages are rendered in the same Skia canvas: template blueprint descends, compartments fill with grade ladders showing per-domain functioning levels, accommodation ring lights up with evidence labels, goal paths populate with stepping stones and IEP star pins, activation pulse connects everything, tutor connections extend outward with per-subject delivery levels. Followed by the three-button decision: Approve / Add Context and Rebuild / Start Over.

---

## Offline Architecture

### SQLite Schema (expo-sqlite)

```sql
-- Brain snapshot cache
brain_cache (
  learner_id TEXT PRIMARY KEY,
  brain_state TEXT NOT NULL,          -- JSON string of full Brain context
  fetched_at INTEGER NOT NULL         -- Unix timestamp
);

-- Pre-fetched lesson beats
lesson_cache (
  lesson_id TEXT PRIMARY KEY,
  beats TEXT NOT NULL,                -- JSON array of StageBeat objects
  audio_paths TEXT,                   -- JSON array of local file paths for TTS
  cached_at INTEGER NOT NULL
);

-- Offline interaction queue
sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,           -- 'session.completed', 'xp.awarded', etc.
  payload TEXT NOT NULL,              -- JSON event payload
  created_at INTEGER NOT NULL,
  synced INTEGER DEFAULT 0
);

-- Gamification cache
gamification_cache (
  learner_id TEXT PRIMARY KEY,
  xp INTEGER, level INTEGER, coins INTEGER, gems INTEGER,
  streak_days INTEGER, streak_frozen INTEGER,
  badges TEXT,                        -- JSON array
  updated_at INTEGER
);
```

### Sync Behavior

**Going offline:** TanStack Query's `networkMode: 'offlineFirst'` serves cached Brain context and gamification data. Up to 10 pre-fetched lesson beat sequences available in `lesson_cache`. TTS audio files stored via `expo-file-system`.

**While offline:** Learner completes cached lessons. All interactions (session completions, XP awards, streak updates) written to `sync_queue` with `synced: 0`. Brain context comes from `brain_cache`. No live tutor sessions (require SSE streaming). No homework upload (requires Vision AI). No multiplayer.

**Coming back online:** `NetInfo` detects connectivity. `drainSyncQueue()` reads all `synced: 0` entries, posts each to the server in chronological order, marks `synced: 1` on success. TanStack Query refetches Brain context (server is authoritative, replaces cache). Fresh lessons pre-fetched for next offline period.

---

## Push Notifications

Register device token with comms-svc on login via `expo-notifications`.

| Notification         | NATS Trigger                      | Deep Link                      |
| -------------------- | --------------------------------- | ------------------------------ |
| Brain recommendation | `brain.recommendation.created`    | `/(parent)/recommendations`    |
| Tutor activated      | `tutor.addon.activated`           | `/(parent)/tutors`             |
| IEP goal met         | `brain.iep_goal.met`              | `/(parent)/brain/[childId]`    |
| Streak broken        | `engagement.streak.broken`        | `/(learner)/gamification`      |
| Badge earned         | `engagement.badge.awarded`        | `/(learner)/badges`            |
| Homework ready       | `homework.processed`              | `/(learner)/homework`          |
| Weekly digest        | Weekly cron                       | `/(parent)/progress/[childId]` |
| Level change         | `brain.functioning_level.changed` | `/(parent)/brain/[childId]`    |

Deep links handled in root `_layout.tsx` via Expo Router's `useURL()` hook.

---

## Camera and File Upload

### Homework Photo Capture

`/(learner)/homework`: Open `expo-camera` with overlay guide frame ("Center your homework"). 80px purple capture button with haptic. Preview with "Use Photo" / "Retake." On confirm, upload via `@aivo/ai-client` multipart endpoint. Processing animation (tutor character "reading" the page). Results: extracted problems as interactive `AnswerCard` components.

### IEP Document Upload

`/(parent)/onboard` or `/(parent)/iep/[childId]`: `expo-document-picker` for PDF, `expo-camera` for photo of printed document. Upload to assessment-svc. Processing animation. Parsed fields displayed for parent confirmation (Confirm / Edit / Skip).

---

## Design System: @aivo/mobile-ui

### Token Consumption

```typescript
import { tokens } from "@aivo/brand";

export const theme = {
  colors: {
    primary: tokens.colors.purple[500], // #915EE3
    primaryDark: tokens.colors.purple[600], // #7C3AED
    secondary: tokens.colors.teal[400], // #35CBDA
    navy: tokens.colors.navy, // #1A1A2E
    background: "#FFFBF7",
    card: "#FFFFFF",
    success: tokens.colors.success,
    warning: tokens.colors.warning,
    error: tokens.colors.error,
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  radius: tokens.radius,
  shadows: tokens.shadows,
  fonts: { heading: "Nunito-ExtraBold", body: "Nunito-Regular", mono: "JetBrainsMono-Regular" },
};
```

### Core Components

| Component            | Purpose                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| `AivoButton`         | Pressable with Reanimated scale, haptic on press, rounded-2xl, purple gradient or outline variants |
| `AivoCard`           | View with card shadow, rounded-3xl, warm white background                                          |
| `AivoHeader`         | `expo-linear-gradient` purple gradient with logo                                                   |
| `StatCard`           | Animated stat number (Reanimated `withTiming` on value change)                                     |
| `BrainVisualization` | Skia canvas rendering cross-section, grade ladders, accommodation ring                             |
| `GradeLadder`        | Skia vertical path with Reanimated-driven marker position                                          |
| `TutorCard`          | Tutor avatar image, persona name, subject, subscribe/launch button                                 |
| `XPBar`              | Reanimated width animation with purple gradient fill                                               |
| `StreakFlame`        | Lottie flame, day count overlay                                                                    |
| `BadgeIcon`          | Image with rarity-colored border, sparkle Lottie on first reveal                                   |
| `AnswerCard`         | Large touchable, illustration, haptic feedback, correct/incorrect Reanimated animation             |
| `DragTarget`         | Gesture handler drop zone, snap Reanimated spring, haptic on drop                                  |
| `MicButton`          | Pulsing Reanimated ring, expo-av recording, Whisper STT via API                                    |
| `DrawCanvas`         | Skia touch drawing surface, thick forgiving lines                                                  |
| `EmptyState`         | Illustration + message + CTA button                                                                |

Every interactive component accepts sensory context and adapts (touch target size, animation intensity, haptic on/off).

---

## Accessibility

### VoiceOver / TalkBack

Every interactive element has `accessibilityLabel`, `accessibilityRole`, and `accessibilityHint`. Screen content is described in reading order. The Stage's Skia canvas is invisible to screen readers; all interactive elements are RN Views overlaid on the canvas with full accessibility attributes. When the tutor speaks, a live region announcement is posted via `AccessibilityInfo.announceForAccessibility()`.

### Switch Access

The Response Zone's answer cards are focusable in sequence. iOS Switch Control and Android Switch Access navigate between cards using the system's built-in scanning. The Stage does not interfere with system switch scanning because interactive elements are native RN Views, not canvas-drawn.

For the NON_VERBAL switch-scan mode (AIVO's custom in-app scanning), the app implements its own highlight loop: a Reanimated-driven glowing border cycles between the 2 answer options at a configurable speed. The learner's external switch triggers a `keyDown` event that the app listens for via `Keyboard` API or accessibility action.

### Dynamic Type

All text uses RN `Text` component with `allowFontScaling={true}`. Layouts use flexbox so they reflow at larger sizes. The Stage's Skia-rendered text uses a font size multiplied by `PixelRatio.getFontScale()`.

### Reduced Motion

On mount, check `AccessibilityInfo.isReduceMotionEnabled`. If true, all Reanimated animations use `withTiming({ duration: 0 })`, Lottie autoPlay is disabled (show static frame), and Skia particle effects are replaced with static glows.

---

## App Store Configuration

### iOS

- Minimum: iOS 16.0
- Universal: iPhone + iPad
- iPad: Support Split View (parent co-view alongside learner Stage)
- Category: Education
- Content rating: 4+ (no objectionable content)
- COPPA: declare in App Store Connect kids section
- Privacy labels: list all data collected per Apple requirements
- In-app purchases: tutor subscriptions (or web-only billing to avoid 30% Apple cut, use StoreKit External Purchase Link entitlement if eligible)

### Android

- Minimum: API 28 (Android 9.0)
- Target: API 35
- Category: Education
- Content rating: Everyone (IARC)
- Designed for Families: enroll
- Data safety: declare all data types per Google Play requirements

### EAS Build Configuration

```json
// eas.json
{
  "build": {
    "preview": { "distribution": "internal", "channel": "preview" },
    "staging": { "distribution": "internal", "channel": "staging" },
    "production": { "distribution": "store", "channel": "production", "autoIncrement": true }
  },
  "submit": {
    "production": {
      "ios": { "appleId": "...", "ascAppId": "...", "appleTeamId": "..." },
      "android": { "serviceAccountKeyPath": "./play-store-key.json", "track": "internal" }
    }
  }
}
```

---

## Testing

### Unit Tests (Jest + RNTL)

Every component, hook, and utility function has unit tests. Import `@aivo/events`, `@aivo/functioning-levels`, `@aivo/brand` in tests to verify type compatibility and shared logic works identically to web.

### E2E Tests (Detox)

| Flow              | Steps                                                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Parent onboarding | Signup, COPPA consent, add child, parent assessment, IEP upload, Building Sequence, approve Brain, view dashboard                                            |
| Learner session   | PIN login, world map, tap quest, Stage loads, complete activity, XP awarded, streak updated, view Brain                                                      |
| Tutor session     | Parent subscribes to tutor (any of 14), learner opens tutor, SSE streams, complete session, mastery updated                                                  |
| Homework          | Learner opens homework, simulated camera capture, OCR processes, adapted view, complete session                                                              |
| Gamification      | Complete activity, verify XP, verify streak, open shop, purchase item, verify avatar update                                                                  |
| Teacher flow      | Login, view classroom, tap student, view Brain, submit insight, generate lesson plan                                                                         |
| Caregiver flow    | Login, view assigned children, tap child, view Brain summary, view accommodations, view IEP goals, view session log, submit observation, check notifications |
| Therapist flow    | Login, view client list, tap client, view HIPAA-scoped Brain, align therapy goal with IEP goal, submit session notes, generate progress report               |
| Offline           | Disable network, complete cached lesson, re-enable network, verify sync queue drains                                                                         |
| All 14 tutors     | Verify each tutor loads persona, streams SSE, renders on Stage, writes mastery back to Brain                                                                 |

### Performance Targets

| Metric                       | Target                          |
| ---------------------------- | ------------------------------- |
| Cold start to dashboard      | < 2 seconds                     |
| Stage first render (60fps)   | Verified on iPhone 12 / Pixel 6 |
| Cached lesson load           | < 500ms                         |
| Tutor SSE first token        | < 2 seconds                     |
| Offline mode activation      | < 1 second                      |
| Sync queue drain (50 events) | < 30 seconds                    |
| Lottie tutor load            | < 500ms                         |
| Brain visualization render   | < 300ms                         |

---

## Build Timeline

| Week  | Deliverables                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-2   | Expo scaffold, Expo Router routes for all 5 roles (parent, learner, teacher, caregiver, therapist), `@aivo/mobile-ui` core components (AivoButton, AivoCard, AivoHeader, StatCard, EmptyState), auth flows (parent login + OAuth, learner PIN pad, teacher/caregiver/therapist login), secure token storage, role-based shell routing with bottom tab navigators per role                                                                 |
| 3-4   | Parent dashboard (child cards, recommendation badges), Brain Skia visualization (cross-section, grade ladders, accommodation ring, goal paths), recommendation inbox (APPROVE/DECLINE/ADD CONTEXT), IEP upload flow (camera + document picker + parsed confirmation), care team management (invite teacher/caregiver/therapist)                                                                                                           |
| 5-7   | Stage Skia renderer + SensoryAdapter + BeatRunner, Lottie tutor character system (all 14 tutor personas with state machines), Response Zone (AnswerCard, DragTarget, MicButton, DrawCanvas, YesNo), haptic patterns, audio engine (TTS + sound effects + ambient), Discovery Adventure (6 chapters, adaptive engine, all functioning levels), Building Sequence (6-stage parent onboarding clone visualization with approve/context/deny) |
| 8-9   | Tutor sessions (SSE streaming on Stage for all 14 tutors), tutor store (browse 14 tutors, individual + bundle subscription, Subject Packs), subscription management, homework upload (camera capture + gallery + PDF, OCR processing, adapted homework session with tutor persona)                                                                                                                                                        |
| 10-11 | Gamification dashboard (XP, streaks, badges, daily challenges), avatar shop (50+ items, 6 categories, purchase flow), quest world map (up to 14 worlds, one per tutor, chapter progression, boss battles), multiplayer challenges (1v1, team, tournament, invite codes), leaderboard, badge cabinet, streak/XP Reanimated animations                                                                                                      |
| 12-13 | Caregiver screens (dashboard, child overview, Brain summary, accommodations, IEP goals, session log, observation submission, progress trends, notifications). Teacher screens (classroom, student Brain, insight submission, lesson plan generator, IEP upload, analytics). Therapist screens (client list, HIPAA-scoped Brain, goal alignment, session notes, insurance reports).                                                        |
| 14    | Offline SQLite implementation (Brain cache, lesson cache, sync queue, gamification cache), sync drain logic, TanStack Query offline mode, push notification registration + deep link handling                                                                                                                                                                                                                                             |
| 15-16 | Performance optimization (Hermes engine, Skia render profiling, asset lazy loading), accessibility audit (VoiceOver, TalkBack, Switch Access, Dynamic Type, Reduced Motion), Detox E2E suite for all flows including caregiver and therapist, app store assets (screenshots for all 5 roles, preview videos, descriptions, privacy labels), TestFlight + Google Play internal testing, store submission                                   |

---

## What This App Is

This is a fully native React Native application that shares TypeScript types, API clients, and business logic with the web app through the monorepo. It serves 5 user roles with dedicated screen sets: Parents (14 screens including Brain visualization, recommendation inbox, co-learning, and the Building Sequence), Learners (12 screens including The Stage, 14 tutor sessions, homework helper, and full gamification), Teachers (6 screens including lesson plan generator), Caregivers (10 screens including Brain summary, accommodations, IEP goals, session logs, observation submission, and progress trends), and Therapists (5 screens including HIPAA-scoped Brain and insurance-formatted reports). Platform Admin and District Admin are web-only roles. All 14 AI tutors (Nova, Sage, Spark, Chrono, Pixel, Echo, Harmony, Atlas, Cadence, Vigor, Lingua, Forge, Compass, Muse) are fully supported with distinct Lottie personas, SSE streaming, and Stage rendering. The Stage is native Skia. The tutor characters are native Lottie. The haptics are native. The offline storage is native SQLite. The camera is native. The push notifications are native. It imports 9 shared packages directly from the monorepo with zero reimplementation. Every feature the web app has for these 5 roles, the mobile app has. Where mobile can do things the web cannot, it does.
