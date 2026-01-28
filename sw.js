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

// Normalize app-shell URLs for robust matching (GitHub Pages subfolder safe)
const SHELL_URLS = new Set(APP_SHELL.map((p) => new URL(p, self.location).href));

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
    if (url.origin !== self.location.origin) return;

    // Navigation: network-first, fallback to cached index.html
    if (req.mode === "navigate") {
        event.respondWith((async () => {
            const cache = await caches.open(CACHE_NAME);
            try {
                const fresh = await fetch(req);
                // IMPORTANT: always update the cached index.html under a stable key
                await cache.put(new Request("./index.html"), fresh.clone());
                return fresh;
            } catch {
                const cached = await cache.match(new Request("./index.html"));
                return cached || new Response("Offline", {
                    status: 200,
                    headers: { "Content-Type": "text/plain" }
                });
            }
        })());
        return;
    }

    // For static files in shell: cache-first
    if (SHELL_URLS.has(req.url)) {
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

    // Default: network-first, fallback to cache
    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
            const fresh = await fetch(req);
            cache.put(req, fresh.clone());
            return fresh;
        } catch {
            const hit = await cache.match(req);
            return hit || new Response("", { status: 504 });
        }
    })());
});
