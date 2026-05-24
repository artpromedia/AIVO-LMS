import { SurfaceRouter } from "../src";

export default { title: "LearnerSurfaces/Math" };

export const Basic = () => (
  <SurfaceRouter
    item={{
      id: "math-story",
      surfaceType: "math_expression",
      prompt: "Solve: 3 + 4 = ?",
      expectedAnswer: "7",
      answerInput: { type: "text", label: "Your answer", placeholder: "Type your answer" },
    }}
    onSubmitAndAdvance={() => {}}
  />
);
