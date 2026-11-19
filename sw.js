// Service worker : le jeu reste jouable hors ligne une fois ouvert (cache, puis mise à jour en arrière-plan).
const CACHE = "valdren-v1";
const FICHIERS = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FICHIERS)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => { if (e.request.method !== "GET") return;
  e.respondWith(caches.open(CACHE).then(async c => { const enCache = await c.match(e.request);
    const reseau = fetch(e.request).then(r => { if (r && (r.ok || r.type === "opaque")) c.put(e.request, r.clone()); return r; }).catch(() => enCache);
    return enCache || reseau; })); });
