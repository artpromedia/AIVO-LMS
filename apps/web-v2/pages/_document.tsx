// AIVO uses App Router exclusively. This file exists ONLY so that
// Next 15's build-time emission of the legacy Pages-Router /_error
// fallback (used to generate /404.html alongside the App-Router not-found
// page) has a valid /_document and stops failing with
//   "<Html> should not be imported outside of pages/_document"
// during `next build`.
//
// Nothing in the running application ever renders this file; the
// App Router not-found.tsx is the real 404 surface at runtime.
import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html>
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
