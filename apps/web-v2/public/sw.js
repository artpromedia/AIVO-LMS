/*
 * Sprint 11 — Learner offline shell service worker.
 *
 * Strategy:
 *  - HTML/navigation requests: network-first, fall back to the cached
 *    "/offline.html" shell so a learner who loses connectivity sees a
 *    friendly page instead of the browser's dino.
 *  - Static assets under /_next/static or /images: stale-while-revalidate
 *    so the second offline load of the shell still paints with art +
 *    branding intact.
 *  - Everything else (API, auth, billing webhook callbacks, the
 *    learner-events stream): pass through to the network untouched. We
 *    NEVER cache POSTs or anything with an Authorization header.
 *  - SW only registers in production builds (see PwaRegister.tsx);
 *    development hot-reload would otherwise serve a stale shell.
 */

const SW_VERSION = "v1";
const SHELL_CACHE = `aivo-shell-${SW_VERSION}`;
const STATIC_CACHE = `aivo-static-${SW_VERSION}`;
const OFFLINE_URL = "/offline.html";
const SHELL_PRECACHE = [OFFLINE_URL, "/images/favicon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== STATIC_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/images/") ||
    url.pathname === "/favicon.ico"
  );
}

function isApiOrAuth(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/login") ||
    url.pathname.startsWith("/signup")
  );
}

// Sprint 1.3 — surface telemetry offline retry.
// The lesson player buffers telemetry events in localStorage and posts
// batches at /api/bff/learning/surface-telemetry. When the page is
// hidden or going offline, it dispatches a "telemetry-sync" message
// over postMessage; this SW handler triggers a Background Sync when
// available so the browser retries the POST after connectivity comes
// back. We deliberately don't cache POSTs (the buffer itself is the
// source of truth) — Background Sync just wakes the client which
// re-runs the queued flush.
self.addEventListener("message", (event) => {
  if (!event.data || event.data.type !== "telemetry-sync") return;
  if (!("sync" in self.registration)) return;
  // Tag is a no-op for the client — the SW just relays a "sync" event
  // back to the active client when the platform fires it.
  event.waitUntil(self.registration.sync.register("aivo-telemetry-sync").catch(() => undefined));
});

self.addEventListener("sync", (event) => {
  if (event.tag !== "aivo-telemetry-sync") return;
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) {
        client.postMessage({ type: "telemetry-flush" });
      }
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isApiOrAuth(url)) return;

  // Static: stale-while-revalidate.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
    return;
  }

  // HTML / navigation: network-first, fall back to offline shell.
  const accept = request.headers.get("accept") || "";
  if (request.mode === "navigate" || accept.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful shell HTML for offline navigation back
          // into the learner area.
          if (response.ok && url.pathname.startsWith("/learner")) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(SHELL_CACHE);
          const cached = await cache.match(request);
          if (cached) return cached;
          const offline = await cache.match(OFFLINE_URL);
          return (
            offline ||
            new Response("Offline", { status: 503, headers: { "content-type": "text/plain" } })
          );
        }),
    );
  }
});
