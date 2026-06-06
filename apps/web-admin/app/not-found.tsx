import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <section className="admin-card max-w-lg p-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">404</p>
        <h1 className="mt-3 text-3xl font-bold">Admin route not found</h1>
        <p className="mt-3 text-slate-600">This standalone admin console only serves privileged routes.</p>
        <Link className="admin-button mt-6" href="/platform">
          Return to platform
        </Link>
      </section>
    </main>
  );
}
