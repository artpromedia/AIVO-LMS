// Pairs with /_document and /_app: gives the Pages-Router error
// fallback an explicit component so the build-time /500 emission
// doesn't pull in the default one that crashes with
//   "<Html> should not be imported outside of pages/_document".
// Not used at runtime — App Router error.tsx is the real error surface.
export default function ErrorPage({ statusCode }: { statusCode?: number }) {
  return (
    <main style={{ padding: "4rem 1.5rem", textAlign: "center" }}>
      <p style={{ fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {statusCode ?? "Error"}
      </p>
      <h1 style={{ fontSize: "2.25rem", fontWeight: 700, marginTop: "0.5rem" }}>
        Something went wrong
      </h1>
      <p style={{ marginTop: "0.75rem" }}>
        <a href="/" style={{ textDecoration: "underline" }}>
          Back to home
        </a>
      </p>
    </main>
  );
}

ErrorPage.getInitialProps = ({ res, err }: { res?: { statusCode?: number }; err?: { statusCode?: number } }) => {
  const statusCode = res?.statusCode ?? err?.statusCode ?? 404;
  return { statusCode };
};
