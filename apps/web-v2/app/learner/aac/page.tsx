/**
 * Learner-facing AAC board. Renders the board returned by brain-svc
 * (proxied through family-svc; consumed via the BFF wrapper). Each tile
 * speaks its label via the browser TTS API on tap — the BFF-mediated
 * cloud TTS path is used by the lesson player; here, fast local TTS is the
 * right trade-off for fluent AAC use.
 *
 * Layout: full-screen grid + a high-contrast title bar so a caregiver can
 * see at a glance which learner's board is up. The grid component itself
 * (`SymbolBoard`) handles role=grid + aria-labels.
 */
import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { readActiveLearnerFromCookies } from "@/lib/auth/active-learner";
import { getLearner } from "@/lib/db/repos";
import { SymbolBoard } from "@/components/AAC/SymbolBoard";

export const dynamic = "force-dynamic";

export default async function AACPage(): Promise<JSX.Element> {
  const session = await requirePageRole(["learner", "parent"]);

  let learnerId: string | null = null;
  if (session.role === "learner") {
    learnerId = session.learnerId ?? null;
  } else {
    learnerId = await readActiveLearnerFromCookies(session);
    if (!learnerId) redirect("/learner/select");
  }
  if (!learnerId) redirect("/login");
  const learner = getLearner(learnerId, session.tenantId);
  if (!learner) redirect(session.role === "parent" ? "/learner/select" : "/login");

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          background: "#0f172a",
          color: "#ffffff",
          borderRadius: 8,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 24 }}>{learner.name}&rsquo;s board</h1>
        <a
          href="/learner/home"
          style={{
            color: "#ffffff",
            textDecoration: "underline",
            padding: "8px 12px",
            minHeight: 44,
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          Back to home
        </a>
      </header>
      <SymbolBoard learnerId={learnerId} />
    </main>
  );
}
