import type { Meta, StoryObj } from "@storybook/react";
import { ArtCanvasSurface } from "../src/surfaces/ArtCanvasSurface";

const meta: Meta<typeof ArtCanvasSurface> = {
  title: "LearnerSurfaces/DrawingCanvas",
  component: ArtCanvasSurface,
};

export default meta;

type Story = StoryObj<typeof ArtCanvasSurface>;

export const Default: Story = {
  args: {
    surface: {
      id: "art-story-1",
      type: "art_canvas",
      prompt: "Draw a tree using two colors.",
      capture: { finalAnswer: true, inkStrokes: true },
      scoring: { mode: "process" },
      accessibility: {
        altText: "Drawing canvas",
        reduceMotionSafe: true,
        keyboardAlternative: true,
      },
      artCanvas: {
        width: 520,
        height: 320,
        showGuides: true,
        palette: ["#1B1B1B", "#2C7BB6", "#D14D41"],
      },
    },
  },
};
