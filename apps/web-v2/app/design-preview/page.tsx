import type { Metadata } from "next";
import "./preview.css";
import { DesignPreview } from "./preview-client";

export const metadata: Metadata = {
  title: "AIVO · Steady Signal",
  description: "Interactive cross-surface proof of AIVO's Steady Signal design system.",
};

export default function DesignPreviewPage() {
  return <DesignPreview />;
}
