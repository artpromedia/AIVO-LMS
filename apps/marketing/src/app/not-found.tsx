import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-iw-purple-50/40 via-white to-white">
      <header className="border-b border-iw-border bg-white">
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
        <p className="font-heading text-6xl font-bold text-iw-primary">404</p>
        <h1 className="mt-4 font-heading text-3xl font-bold text-iw-ink md:text-4xl">
          We could not find that page
        </h1>
        <p className="mt-3 font-body text-lg text-iw-ink-muted">
          The page may have moved. Here are a few places people usually want to be next.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center rounded-iw-control bg-iw-primary px-6 py-3 font-bold text-white shadow-soft-3 transition hover:bg-iw-primary-hover"
          >
            Home
          </Link>
          <Link
            href="/for-parents"
            className="inline-flex min-h-[44px] items-center rounded-iw-control border border-iw-purple-200 bg-white px-6 py-3 font-bold text-iw-primary transition hover:bg-iw-purple-100"
          >
            For parents
          </Link>
          <Link
            href="/for-schools"
            className="inline-flex min-h-[44px] items-center rounded-iw-control border border-iw-purple-200 bg-white px-6 py-3 font-bold text-iw-primary transition hover:bg-iw-purple-100"
          >
            For schools
          </Link>
          <Link
            href="/contact"
            className="inline-flex min-h-[44px] items-center rounded-iw-control border border-iw-purple-200 bg-white px-6 py-3 font-bold text-iw-primary transition hover:bg-iw-purple-100"
          >
            Contact
          </Link>
        </div>
      </main>
    </div>
  );
}
