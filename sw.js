const CACHE_NAME = "burger-folie-planner-v41";
const ASSETS = [
  "./",
  "./index.html",
  "./app.css",
  "./launch.css?v=41",
  "./app.js?v=41",
  "./extras.js?v=41",
  "./mobile-fix.js?v=41",
  "./manifest.webmanifest",
  "./assets/burger-folie-logo.png",
  "./assets/apple-touch-icon.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(async response => {
        const nextResponse = await maybeInjectMobileFix(event.request, response);
        const copy = nextResponse.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return nextResponse;
      })
      .catch(() => caches.match(event.request).then(response => response && maybeInjectMobileFix(event.request, response)))
  );
});

async function maybeInjectMobileFix(request, response) {
  const isHtml = request.mode === "navigate" ||
    request.destination === "document" ||
    request.url.endsWith("/") ||
    request.url.includes("index.html");

  if (!isHtml || !response || response.status >= 400) {
    return response;
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType && !contentType.includes("text/html")) {
    return response;
  }

  const html = await response.clone().text();
  if (html.includes("mobile-fix.js")) {
    return response;
  }

  const fixedHtml = html.replace("</body>", "  <script src=\"./mobile-fix.js?v=41\" defer></script>\n</body>");
  const headers = new Headers(response.headers);
  headers.set("content-type", "text/html;charset=utf-8");
  return new Response(fixedHtml, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
