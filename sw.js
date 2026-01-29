const CACHE = "partner-ringer-v3";

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./soft-alarm1.mp3"
];

self.addEventListener("install", e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", e=>{
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => k !== CACHE && caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", e=>{
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});

self.addEventListener("notificationclick", e=>{
  e.notification.close();
  e.waitUntil(clients.openWindow("./"));
});