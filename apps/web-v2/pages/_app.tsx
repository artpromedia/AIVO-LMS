// Minimal Pages-Router /_app, paired with /_document, so the
// build-time emission of the /_error fallback that Next 15 still
// produces alongside App-Router routes doesn't crash with
//   "<Html> should not be imported outside of pages/_document".
// Not used at runtime.
import type { AppProps } from "next/app";

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
