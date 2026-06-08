import { redirect } from "next/navigation";

// AI content moderation is served by the unified safety moderation queue.
export default function AiModerationPage() {
  redirect("/platform/safety/moderation");
}
