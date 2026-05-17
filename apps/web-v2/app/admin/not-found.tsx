import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AdminNotFound() {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center"
    >
      <p className="text-sm font-medium uppercase tracking-wide text-aivo-muted">
        Admin console · 404
      </p>
      <h1 className="mt-2 font-display text-4xl font-bold">
        That page is not here.
      </h1>
      <p className="mt-3 text-aivo-ink-soft">
        It may have been moved or the resource has been removed.
      </p>
      <div className="mt-6">
        <Button asChild>
          <Link href="/admin">Admin home</Link>
        </Button>
      </div>
    </main>
  );
}
