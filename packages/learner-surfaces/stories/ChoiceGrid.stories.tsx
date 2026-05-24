import { SurfaceRouter } from "../src";

export default { title: "LearnerSurfaces/ChoiceGrid" };

export const Basic = () => (
  <SurfaceRouter
    item={{
      id: "choice-grid-story",
      surfaceType: "choice_grid",
      prompt: "Which number equals 2 + 2?",
      choices: ["2", "3", "4", "5"],
      expectedAnswer: "4",
    }}
    onSubmitAndAdvance={() => {}}
  />
);
