"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1.5rem", textAlign: "center" }}
      >
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700 }}>Something went very wrong.</h1>
        <p style={{ marginTop: "0.75rem", color: "#555" }}>
          Please try again. If this keeps happening, contact support.
        </p>
        {error.digest ? (
          <p style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "#888" }}>
            Reference: {error.digest}
          </p>
        ) : null}
        <button
          onClick={() => reset()}
          style={{
            marginTop: "1.25rem",
            padding: "0.6rem 1rem",
            borderRadius: 8,
            background: "#3b3bd1",
            color: "white",
            border: 0,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
