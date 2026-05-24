import { SurfaceRouter } from "../src";

export default { title: "LearnerSurfaces/Geometry" };

export const Basic = () => (
  <SurfaceRouter
    item={{
      id: "geometry-story",
      surfaceType: "geometry_workspace",
      prompt: "Move the rectangle and submit.",
      diagram: {
        canvasMode: "svg",
        width: 480,
        height: 300,
        shapes: [{ id: "rect-1", kind: "rectangle", x: 140, y: 90, width: 180, height: 100 }],
      },
      answerInput: { type: "text", label: "What changed?" },
    }}
    onSubmitAndAdvance={() => {}}
  />
);
