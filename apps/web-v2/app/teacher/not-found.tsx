import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function TeacherNotFound() {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center"
    >
      <p className="text-sm font-medium uppercase tracking-wide text-aivo-muted">
        Teacher area · 404
      </p>
      <h1 className="mt-2 font-display text-4xl font-bold">We couldn't find that page.</h1>
      <p className="mt-3 text-aivo-ink-soft">
        The link may have moved, or the learner is no longer enrolled in your class.
      </p>
      <div className="mt-6 flex gap-3">
        <Button asChild>
          <Link href="/teacher/home">Teacher home</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/teacher/classes">My classes</Link>
        </Button>
      </div>
    </main>
  );
}
