// @vitest-environment jsdom
/**
 * Pinned contract (Sprint C-04, decision D1a): the parent brain-clone-watch
 * screen NEVER renders an approval control it cannot honor. The old
 * "Approve profile" / "Ask for changes" buttons only routed to
 * /(parent)/recommendations without approving anything — they must stay
 * gone. Instead:
 *
 *   - unapproved profile  → honest web handoff card: "Open on the web"
 *     launches the learner's web review URL via expo-linking, "Copy link"
 *     copies it; link-open failure shows an inline message; a build with
 *     no web origin configured hides the open button entirely (never a
 *     dead tap) and keeps copy-link.
 *   - approved profile    → the existing approved card, unchanged.
 *   - loading / still-building → the existing states, unchanged.
 *
 * Rendering runs through react-dom in jsdom with react-native and the
 * expo modules mocked below — all mocks are confined to this test file.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";

// The mobile workspace ships react-dom (for Expo web) but not
// @types/react-dom, so the module resolves untyped; type the two pieces
// this test uses locally. If @types/react-dom is ever added, the
// now-unused suppression below will fail typecheck and can be removed.
// @ts-expect-error: react-dom/client is untyped in this workspace
import { createRoot } from "react-dom/client";

// vi.mock calls are hoisted above this import, so the screen sees the
// mocked react-native/expo modules when it loads.
import ParentBrainCloneWatchScreen from "../app/(parent)/brain-clone-watch/[childId]";

interface Root {
  render(children: React.ReactNode): void;
  unmount(): void;
}

const useBrainMock = vi.fn();
const routerPushMock = vi.fn();
const openURLMock = vi.fn();
const setStringAsyncMock = vi.fn();

vi.mock("react-native", async () => {
  const ReactActual = await import("react");
  const host =
    (tag: string) =>
    ({
      children,
      accessibilityLabel,
      accessibilityLiveRegion,
      testID,
    }: Record<string, unknown> & { children?: React.ReactNode }) =>
      ReactActual.createElement(
        tag,
        {
          "aria-label": accessibilityLabel as string | undefined,
          "aria-live": accessibilityLiveRegion as string | undefined,
          "data-testid": testID as string | undefined,
        },
        children,
      );
  const Pressable = ({
    children,
    onPress,
    disabled,
    accessibilityLabel,
  }: Record<string, unknown> & { children?: React.ReactNode }) =>
    ReactActual.createElement(
      "button",
      {
        type: "button",
        onClick: onPress as () => void,
        disabled: Boolean(disabled),
        "aria-label": accessibilityLabel as string | undefined,
      },
      typeof children === "function"
        ? (children as (s: { pressed: boolean }) => React.ReactNode)({ pressed: false })
        : children,
    );
  return {
    View: host("div"),
    Text: host("span"),
    Pressable,
    ActivityIndicator: () =>
      ReactActual.createElement("span", { "data-testid": "activity-indicator" }),
    StyleSheet: { create: <T,>(s: T) => s, flatten: <T,>(s: T) => s },
    Platform: {
      OS: "ios",
      select: (options: Record<string, unknown>) =>
        "ios" in options ? options.ios : options.default,
    },
    useWindowDimensions: () => ({ width: 390, height: 844, scale: 2, fontScale: 1 }),
    I18nManager: { isRTL: false, allowRTL: () => {}, forceRTL: () => {} },
  };
});

vi.mock("@expo/vector-icons", async () => {
  const ReactActual = await import("react");
  return {
    Ionicons: ({ name }: { name: string }) =>
      ReactActual.createElement("span", { "data-icon": name }),
  };
});

vi.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ childId: "learner-1" }),
  router: {
    push: (...args: unknown[]) => routerPushMock(...args),
    replace: vi.fn(),
    back: vi.fn(),
  },
}));

vi.mock("expo-linking", () => ({
  openURL: (url: string) => openURLMock(url),
}));

vi.mock("expo-clipboard", () => ({
  setStringAsync: (text: string) => setStringAsyncMock(text),
}));

// Same calling contract as @/hooks/useTranslation: the screen passes
// fully-interpolated template literals as defaultValue, so returning the
// default yields the parent-facing English copy.
vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (
      key: string,
      defaultValueOrOptions?: string | Record<string, unknown>,
      options?: Record<string, unknown>,
    ) => {
      if (typeof defaultValueOrOptions === "string") return defaultValueOrOptions;
      const dflt = defaultValueOrOptions?.defaultValue ?? options?.defaultValue;
      return typeof dflt === "string" ? dflt : key;
    },
  }),
}));

vi.mock("@/hooks/useLearners", () => ({
  useLearner: () => ({ data: { id: "learner-1", firstName: "Maya" } }),
}));

vi.mock("@/hooks/useBrain", () => ({
  useBrain: (learnerId: string) => useBrainMock(learnerId),
  labelForDomain: (domain: string) => domain,
}));

vi.mock("@/lib/feature-flags", () => ({
  isFlagOn: () => true,
}));

// Re-export the REAL Button and Card (the components under test render
// through them) without loading the rest of the barrel — the other
// barrel components never render here and would only skew coverage.
vi.mock("@/components/ui", async () => {
  const { Button } =
    await vi.importActual<typeof import("../components/ui/Button")>("../components/ui/Button");
  const { Card } =
    await vi.importActual<typeof import("../components/ui/Card")>("../components/ui/Card");
  return { Button, Card };
});

// The real module `require`s bundled .ttf assets, which the node/jsdom
// harness cannot load. Only the family-name strings matter to styles.
vi.mock("@/constants/typography", () => ({
  fontFamilies: {
    displayRegular: "Fredoka-Regular",
    displayMedium: "Fredoka-Medium",
    displaySemiBold: "Fredoka-SemiBold",
    displayBold: "Fredoka-Bold",
    bodyRegular: "Nunito-Regular",
    bodySemiBold: "Nunito-SemiBold",
    bodyBold: "Nunito-Bold",
    bodyExtraBold: "Nunito-ExtraBold",
  },
}));

vi.mock("@/context/SensoryModeProvider", () => {
  const palette = {
    bgPage: "#f4f6f5",
    bgCard: "#ffffff",
    bgRaised: "#f8f9f8",
    primary: "#7c3aed",
    primaryHover: "#6d28d9",
    primaryFg: "#ffffff",
    accent: "#14b8a6",
    accentSoft: "#ccfbf1",
    warm: "#f97316",
    warmSoft: "#ffedd5",
    ink: "#090909",
    inkMuted: "#6f7275",
    border: "rgba(0,0,0,0.05)",
    ringFocus: "#7c3aed",
    motionScale: 1,
    shadowStrength: 0,
  };
  return {
    useSensoryPalette: () => palette,
    useSensoryMode: () => ({
      mode: "standard",
      palette,
      motionScale: 1,
      shadowStrength: 0,
      setMode: async () => {},
      cycleMode: async () => {},
      isHydrated: true,
    }),
  };
});

vi.mock("@/src/components/layout/ResponsiveScreen", async () => {
  const ReactActual = await import("react");
  return {
    ResponsiveScreen: ({ children }: { children?: React.ReactNode }) =>
      ReactActual.createElement("div", null, children),
  };
});

vi.mock("@/src/components/layout/ScreenHeader", async () => {
  const ReactActual = await import("react");
  return {
    ScreenHeader: ({ title }: { title?: string }) =>
      ReactActual.createElement("div", null, title),
  };
});

vi.mock("@aivo/mobile-ui", async () => {
  const ReactActual = await import("react");
  return {
    LoadingState: () => ReactActual.createElement("div", { "data-testid": "loading-state" }),
  };
});

const APPROVE_LABEL = "Approve profile";
const AMEND_LABEL = "Ask for changes";
const OPEN_LABEL = "Open on the web";
const COPY_LABEL = "Copy link";
const REVIEW_URL = "https://app.aivo.test/parent/learners/learner-1/brain-clone-watch";
const REVIEW_PATH = "/parent/learners/learner-1/brain-clone-watch";

const ORIGINAL_WEB_URL = process.env.EXPO_PUBLIC_WEB_URL;

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function brainQuery(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      approvalStatus: "pending",
      version: 2,
      xaiExplanation: {
        mastery_decisions: [{ domain: "math", score: 0.62 }],
        accommodation_decisions: [
          { accommodation: "extra_time", display_label: "Extra time" },
          { accommodation: "text_to_speech" },
        ],
      },
    },
    isLoading: false,
    isFetching: false,
    refetch: vi.fn(),
    ...overrides,
  };
}

async function renderScreen() {
  await act(async () => {
    root.render(React.createElement(ParentBrainCloneWatchScreen));
  });
}

function buttons(): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll("button"));
}

function findButton(label: string): HTMLButtonElement | undefined {
  return buttons().find(
    (b) => b.textContent === label || b.getAttribute("aria-label") === label,
  );
}

async function press(label: string) {
  const btn = findButton(label);
  if (!btn) throw new Error(`no button labelled "${label}"`);
  await act(async () => {
    btn.click();
  });
}

beforeEach(() => {
  useBrainMock.mockReset();
  routerPushMock.mockReset();
  openURLMock.mockReset().mockResolvedValue(true);
  setStringAsyncMock.mockReset().mockResolvedValue(true);
  (globalThis as Record<string, unknown>).__DEV__ = false;
  delete process.env.EXPO_PUBLIC_WEB_URL;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

afterAll(() => {
  if (ORIGINAL_WEB_URL === undefined) delete process.env.EXPO_PUBLIC_WEB_URL;
  else process.env.EXPO_PUBLIC_WEB_URL = ORIGINAL_WEB_URL;
  delete (globalThis as Record<string, unknown>).__DEV__;
});

describe("brain-clone-watch: unapproved profile (web handoff)", () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_WEB_URL = "https://app.aivo.test";
    useBrainMock.mockReturnValue(brainQuery());
  });

  it("renders NO approve/amend control — the dead buttons stay deleted", async () => {
    await renderScreen();

    expect(container.textContent).not.toContain(APPROVE_LABEL);
    expect(container.textContent).not.toContain(AMEND_LABEL);
    expect(findButton(APPROVE_LABEL)).toBeUndefined();
    expect(findButton(AMEND_LABEL)).toBeUndefined();
    // The old handlers' only behavior was router.push("/(parent)/recommendations").
    expect(routerPushMock).not.toHaveBeenCalled();
  });

  it("renders the honest handoff card with open + copy actions", async () => {
    await renderScreen();

    expect(container.textContent).toContain(
      "Reviewing and approving Maya's profile happens on the web for now.",
    );
    expect(findButton(OPEN_LABEL)).toBeDefined();
    expect(findButton(COPY_LABEL)).toBeDefined();
    // Screen-reader labels are learner-specific, not generic.
    expect(findButton(OPEN_LABEL)?.getAttribute("aria-label")).toBe(
      "Open Maya's profile review on the web",
    );
    expect(findButton(COPY_LABEL)?.getAttribute("aria-label")).toBe(
      "Copy the link to Maya's profile review",
    );
  });

  it("'Open on the web' launches this learner's web review URL via Linking.openURL", async () => {
    await renderScreen();
    await press(OPEN_LABEL);

    expect(openURLMock).toHaveBeenCalledTimes(1);
    expect(openURLMock).toHaveBeenCalledWith(REVIEW_URL);
    expect(routerPushMock).not.toHaveBeenCalled();
  });

  it("link-open failure renders its inline message instead of failing silently", async () => {
    openURLMock.mockRejectedValueOnce(new Error("no handler for https"));
    await renderScreen();
    await press(OPEN_LABEL);

    expect(container.textContent).toContain(
      "We couldn't open your browser from here. Copy the link instead — it works anywhere.",
    );
  });

  it("'Copy link' copies the full review URL and confirms inline", async () => {
    await renderScreen();
    await press(COPY_LABEL);

    expect(setStringAsyncMock).toHaveBeenCalledWith(REVIEW_URL);
    expect(container.textContent).toContain(
      "Link copied — paste it into your browser when you're ready.",
    );
  });

  it("a copy that does not take (clipboard returns false) renders the copy-failed message", async () => {
    setStringAsyncMock.mockResolvedValueOnce(false);
    await renderScreen();
    await press(COPY_LABEL);

    expect(container.textContent).toContain(
      "Copying didn't work on this device. Sign in to AIVO on the web to review and approve.",
    );
  });
});

describe("brain-clone-watch: no web origin configured (production build without EXPO_PUBLIC_WEB_URL)", () => {
  beforeEach(() => {
    useBrainMock.mockReturnValue(brainQuery());
  });

  it("hides the open button (never a dead tap) and keeps a working copy-link", async () => {
    await renderScreen();

    expect(findButton(OPEN_LABEL)).toBeUndefined();
    expect(container.textContent).toContain(
      "Sign in to AIVO on the web to review and approve. Copy the link below to have it ready.",
    );

    await press(COPY_LABEL);
    expect(setStringAsyncMock).toHaveBeenCalledWith(REVIEW_PATH);
    expect(container.textContent).toContain(
      "Copied — paste it after your AIVO web address in your browser.",
    );
    expect(openURLMock).not.toHaveBeenCalled();
  });

  it("still renders no approve/amend control", async () => {
    await renderScreen();

    expect(container.textContent).not.toContain(APPROVE_LABEL);
    expect(container.textContent).not.toContain(AMEND_LABEL);
  });
});

describe("brain-clone-watch: dev builds fall back to the local web-v2 dev server", () => {
  it("opens the localhost web origin used by apps/web-v2 in development", async () => {
    (globalThis as Record<string, unknown>).__DEV__ = true;
    useBrainMock.mockReturnValue(brainQuery());
    await renderScreen();
    await press(OPEN_LABEL);

    expect(openURLMock).toHaveBeenCalledWith(`http://localhost:5000${REVIEW_PATH}`);
  });
});

describe("brain-clone-watch: approved profile", () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_WEB_URL = "https://app.aivo.test";
    useBrainMock.mockReturnValue(
      brainQuery({
        data: { approvalStatus: "approved", version: 3, xaiExplanation: {} },
      }),
    );
  });

  it("keeps the existing approved card and renders no handoff", async () => {
    await renderScreen();

    expect(container.textContent).toContain(
      "You've approved this profile. AIVO is teaching with it.",
    );
    expect(findButton(OPEN_LABEL)).toBeUndefined();
    expect(findButton(COPY_LABEL)).toBeUndefined();
    expect(container.textContent).not.toContain(APPROVE_LABEL);
    expect(container.textContent).not.toContain(AMEND_LABEL);
  });
});

describe("brain-clone-watch: existing loading and still-building states stay intact", () => {
  it("shows the shared loading state while the brain query is in flight", async () => {
    useBrainMock.mockReturnValue(
      brainQuery({ data: undefined, isLoading: true }),
    );
    await renderScreen();

    expect(container.querySelector('[data-testid="loading-state"]')).not.toBeNull();
    expect(findButton(OPEN_LABEL)).toBeUndefined();
    expect(findButton(COPY_LABEL)).toBeUndefined();
  });

  it("shows the still-building card (refresh, no approval controls, no handoff) when the clone is not ready", async () => {
    useBrainMock.mockReturnValue(brainQuery({ data: {} }));
    await renderScreen();

    expect(container.textContent).toContain("Building Maya's brain");
    expect(findButton("Refresh")).toBeDefined();
    expect(findButton(OPEN_LABEL)).toBeUndefined();
    expect(container.textContent).not.toContain(APPROVE_LABEL);
    expect(container.textContent).not.toContain(AMEND_LABEL);
  });
});
