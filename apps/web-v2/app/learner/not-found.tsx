import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LearnerNotFound() {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center"
    >
      <p className="text-sm font-medium uppercase tracking-wide text-aivo-muted">
        404
      </p>
      <h1 className="mt-2 font-display text-4xl font-bold">
        I can't find that one.
      </h1>
      <p className="mt-3 text-aivo-ink-soft">
        Let's head back to your home and pick your next mission.
      </p>
      <div className="mt-6">
        <Button asChild>
          <Link href="/learner/home">Go to my home</Link>
        </Button>
      </div>
    </main>
  );
}
