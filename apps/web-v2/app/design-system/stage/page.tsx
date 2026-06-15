import type { Metadata } from "next";
import "./stage-preview.css";
import { StagePreview } from "./stage-preview-client";

export const metadata: Metadata = {
  title: "AIVO Design System · Stage",
  description:
    "Dev-only preview of the elevated Stage (lesson player) — Task #5 Step 1 spec deliverable.",
};

export default function StageDesignSystemPage() {
  return <StagePreview />;
}
