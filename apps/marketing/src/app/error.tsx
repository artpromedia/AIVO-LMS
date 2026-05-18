"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.error("[marketing-error]", error.message, error.digest);
    }
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-purple-50/40 via-white to-white">
      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-3 md:px-8">
          <Link href="/" className="inline-flex items-center">
            <Image
              src="/images/aivo-logo-purple.png"
              alt="AIVO"
              width={130}
              height={40}
              priority
              style={{ width: "auto", height: "auto" }}
            />
          </Link>
        </div>
      </header>
      <main className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center px-6 py-20 text-center md:px-8">
        <p className="font-heading text-6xl font-bold text-rose-500">500</p>
        <h1 className="mt-4 font-heading text-3xl font-bold text-slate-900 md:text-4xl">
          Something went wrong on our end
        </h1>
        <p className="mt-3 font-body text-lg text-slate-600">
          Sorry about that. The team has been notified. You can try again, or head somewhere else.
        </p>
        {error.digest && (
          <p className="mt-2 font-body text-sm text-slate-400">Reference: {error.digest}</p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-[44px] items-center rounded-full bg-purple-600 px-6 py-3 font-bold text-white shadow-lg transition hover:bg-purple-700"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center rounded-full border border-purple-200 bg-white px-6 py-3 font-bold text-purple-700 transition hover:bg-purple-50"
          >
            Home
          </Link>
          <Link
            href="/contact"
            className="inline-flex min-h-[44px] items-center rounded-full border border-purple-200 bg-white px-6 py-3 font-bold text-purple-700 transition hover:bg-purple-50"
          >
            Contact us
          </Link>
        </div>
      </main>
    </div>
  );
}
