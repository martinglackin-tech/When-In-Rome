// Offline support. Bump CACHE when the list of files changes.
const CACHE = 'wir-v2';
// Filled by app.js (loadRecordings); listed here so activate doesn't delete it.
const AUDIO_CACHE = 'wir-audio-v1';
const FILES = ['./', 'index.html', 'data.js', 'app.js', 'manifest.webmanifest', 'icons/icon.svg', 'fonts/schibsted-grotesk-latin-400-normal.woff2', 'fonts/schibsted-grotesk-latin-600-normal.woff2', 'fonts/schibsted-grotesk-latin-800-normal.woff2'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE)
            .then(cache => cache.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== AUDIO_CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

// Network first so the page and scripts always come from the same deploy; cache when offline.
self.addEventListener('fetch', (event) => {
    const { request } = event;
    // Recordings are cached by the page itself (AUDIO_CACHE).
    if (new URL(request.url).pathname.includes('/audio/')) return;
    if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
    const key = request.mode === 'navigate' ? 'index.html' : request;
    event.respondWith(
        fetch(request, { cache: 'no-cache' })
            .then(res => {
                if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
                return res;
            })
            .catch(() => caches.match(key, { ignoreSearch: true }))
    );
});
