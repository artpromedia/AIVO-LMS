"use client";

export default function ErrorPage({ error }: { error: Error }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <section className="admin-card max-w-lg p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-red-700">Error</p>
        <h1 className="mt-3 text-3xl font-bold">Admin console failed to render</h1>
        <p className="mt-3 text-slate-600">{error.message}</p>
      </section>
    </main>
  );
}
