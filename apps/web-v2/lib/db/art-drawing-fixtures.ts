export type ArtDrawingFixtureItem = {
  id: string;
  subjectSlug: "art";
  gradeBand: "PreK-K";
  title: string;
  prompt: string;
  surfaceType: "drawing_canvas";
  expectedAttachments: ["image/png", "image/svg+xml"];
};

export const ART_DRAWING_FIXTURE_ITEMS: ArtDrawingFixtureItem[] = [
  {
    id: "art-drawing-01",
    subjectSlug: "art",
    gradeBand: "PreK-K",
    title: "Rainbow lines",
    prompt: "Draw five curved rainbow lines from left to right.",
    surfaceType: "drawing_canvas",
    expectedAttachments: ["image/png", "image/svg+xml"],
  },
  {
    id: "art-drawing-02",
    subjectSlug: "art",
    gradeBand: "PreK-K",
    title: "Big and small circles",
    prompt: "Draw one big circle and one small circle.",
    surfaceType: "drawing_canvas",
    expectedAttachments: ["image/png", "image/svg+xml"],
  },
  {
    id: "art-drawing-03",
    subjectSlug: "art",
    gradeBand: "PreK-K",
    title: "Happy face",
    prompt: "Draw a happy face with eyes and a smile.",
    surfaceType: "drawing_canvas",
    expectedAttachments: ["image/png", "image/svg+xml"],
  },
  {
    id: "art-drawing-04",
    subjectSlug: "art",
    gradeBand: "PreK-K",
    title: "Sun and sky",
    prompt: "Draw a sun in the top corner and sky lines.",
    surfaceType: "drawing_canvas",
    expectedAttachments: ["image/png", "image/svg+xml"],
  },
  {
    id: "art-drawing-05",
    subjectSlug: "art",
    gradeBand: "PreK-K",
    title: "House shape",
    prompt: "Draw a square with a triangle roof.",
    surfaceType: "drawing_canvas",
    expectedAttachments: ["image/png", "image/svg+xml"],
  },
  {
    id: "art-drawing-06",
    subjectSlug: "art",
    gradeBand: "PreK-K",
    title: "Pattern path",
    prompt: "Draw a zig-zag pattern across the page.",
    surfaceType: "drawing_canvas",
    expectedAttachments: ["image/png", "image/svg+xml"],
  },
  {
    id: "art-drawing-07",
    subjectSlug: "art",
    gradeBand: "PreK-K",
    title: "Tree trunk and leaves",
    prompt: "Draw a tree trunk with round leaf shapes.",
    surfaceType: "drawing_canvas",
    expectedAttachments: ["image/png", "image/svg+xml"],
  },
  {
    id: "art-drawing-08",
    subjectSlug: "art",
    gradeBand: "PreK-K",
    title: "Feeling colors",
    prompt: "Use two colors to draw a calm picture.",
    surfaceType: "drawing_canvas",
    expectedAttachments: ["image/png", "image/svg+xml"],
  },
  {
    id: "art-drawing-09",
    subjectSlug: "art",
    gradeBand: "PreK-K",
    title: "Story picture",
    prompt: "Draw your favorite part of a story.",
    surfaceType: "drawing_canvas",
    expectedAttachments: ["image/png", "image/svg+xml"],
  },
  {
    id: "art-drawing-10",
    subjectSlug: "art",
    gradeBand: "PreK-K",
    title: "Free sketch",
    prompt: "Draw anything you want with at least two colors.",
    surfaceType: "drawing_canvas",
    expectedAttachments: ["image/png", "image/svg+xml"],
  },
];
