import { SurfaceRouter } from "../src";

export default { title: "LearnerSurfaces/NumberLine" };

export const Basic = () => (
  <SurfaceRouter
    item={{
      id: "number-line-story",
      surfaceType: "number_line",
      prompt: "Select number 6 on the line.",
      expectedAnswer: "6",
      numberLine: { min: 0, max: 10, step: 1 },
    }}
    onSubmitAndAdvance={() => {}}
  />
);
