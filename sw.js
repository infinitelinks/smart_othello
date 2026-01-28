/* Smart Othello PWA Service Worker */
const CACHE_NAME = "smart-othello-v1";

// Add anything you want offline here
const APP_SHELL = [
    "./",
    "./index.html",
    "./manifest.webmanifest",
    "./sw.js",
    "./icons/icon-192.png",
    "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)));
        await self.clients.claim();
    })());
});

// Cache-first for app shell, network-first for everything else
self.addEventListener("fetch", (event) => {
    const req = event.request;
    const url = new URL(req.url);

    // Only handle same-origin
    if (url.origin !== location.origin) return;

    // Navigation: try cache, fallback to network, fallback to cached index
    if (req.mode === "navigate") {
        event.respondWith((async () => {
            const cache = await caches.open(CACHE_NAME);
            const cached = await cache.match("./index.html");
            try {
                const fresh = await fetch(req);
                cache.put(req, fresh.clone());
                return fresh;
            } catch {
                return cached || Response.error();
            }
        })());
        return;
    }

    // For static files in shell: cache-first
    if (APP_SHELL.some(p => url.pathname.endsWith(p.replace("./", "")))) {
        event.respondWith((async () => {
            const cache = await caches.open(CACHE_NAME);
            const hit = await cache.match(req);
            if (hit) return hit;
            const fresh = await fetch(req);
            cache.put(req, fresh.clone());
            return fresh;
        })());
        return;
    }

    // Default: network-first
    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
            const fresh = await fetch(req);
            cache.put(req, fresh.clone());
            return fresh;
        } catch {
            const hit = await cache.match(req);
            return hit || Response.error();
        }
    })());
});
