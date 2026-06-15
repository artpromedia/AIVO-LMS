import type { Metadata } from "next";
import "./baseline-preview.css";
import { BaselinePreview } from "./baseline-preview-client";

export const metadata: Metadata = {
  title: "AIVO Design System · Discovery Adventure",
  description:
    "Dev-only preview of the elevated Baseline (Discovery Adventure) — Task #6 Step 1 spec deliverable.",
};

export default function DiscoveryDesignSystemPage() {
  return <BaselinePreview />;
}
