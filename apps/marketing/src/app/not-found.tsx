import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
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
        <p className="font-heading text-6xl font-bold text-purple-600">404</p>
        <h1 className="mt-4 font-heading text-3xl font-bold text-slate-900 md:text-4xl">
          We could not find that page
        </h1>
        <p className="mt-3 font-body text-lg text-slate-600">
          The page may have moved. Here are a few places people usually want to be next.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center rounded-full bg-purple-600 px-6 py-3 font-bold text-white shadow-lg transition hover:bg-purple-700"
          >
            Home
          </Link>
          <Link
            href="/for-parents"
            className="inline-flex min-h-[44px] items-center rounded-full border border-purple-200 bg-white px-6 py-3 font-bold text-purple-700 transition hover:bg-purple-50"
          >
            For parents
          </Link>
          <Link
            href="/for-schools"
            className="inline-flex min-h-[44px] items-center rounded-full border border-purple-200 bg-white px-6 py-3 font-bold text-purple-700 transition hover:bg-purple-50"
          >
            For schools
          </Link>
          <Link
            href="/contact"
            className="inline-flex min-h-[44px] items-center rounded-full border border-purple-200 bg-white px-6 py-3 font-bold text-purple-700 transition hover:bg-purple-50"
          >
            Contact
          </Link>
        </div>
      </main>
    </div>
  );
}
