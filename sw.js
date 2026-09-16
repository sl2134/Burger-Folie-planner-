const CACHE_NAME = "burger-folie-planner-v50";
const ASSETS = [
  "./",
  "./index.html",
  "./?source=pwa",
  "./app.css?v=50",
  "./launch.css?v=50",
  "./app.js?v=50",
  "./extras.js?v=50",
  "./sync.js?v=50",
  "./manifest.webmanifest?v=50",
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

  if (new URL(event.request.url).origin !== self.location.origin) {
    // Leave cross-origin calls (e.g. the GitHub sync API) to the network only,
    // never cached, so sync always reads and writes live data.
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => {
        if (event.request.mode === "navigate") {
          return caches.match("./index.html", { ignoreSearch: true });
        }
        return caches.match(event.request, { ignoreSearch: true });
      })
  );
});
