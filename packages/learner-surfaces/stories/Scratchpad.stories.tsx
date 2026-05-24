import { SurfaceRouter } from "../src";

export default { title: "LearnerSurfaces/Scratchpad" };

export const Basic = () => (
  <SurfaceRouter
    item={{
      id: "scratchpad-story",
      surfaceType: "scratchpad",
      prompt: "Show your work in the scratchpad.",
      scratchpad: { enabled: true, width: 560, height: 280, background: "grid" },
    }}
    onSubmitAndAdvance={() => {}}
  />
);
