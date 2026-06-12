/**
 * /design-preview — Phase 1 live preview for the Learner Experience
 * transformation. A non-destructive, dev-only replica of the learner home
 * that applies the proposed `--lx-*` design system from
 * `learner-experience/DESIGN-DIRECTION.md`.
 *
 * Dev-only: registered in `middleware.ts` DEV_ONLY_PREFIXES, so it 404s in
 * production exactly like the existing `/design-system/*` showcases. It does
 * not call `requirePageRole`, so it renders without a session. Production
 * learner screens are untouched.
 */
import type { Metadata } from "next";
import "./preview.css";
import { DesignPreview } from "./preview-client";

export const metadata: Metadata = {
  title: "AIvo · Learner Experience preview",
  description: "Phase 1 design direction — interactive replica of the learner home.",
};

export default function DesignPreviewPage() {
  return <DesignPreview />;
}
