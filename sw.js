// Offline app shell. Paths are relative to this file, so it works under any GitHub Pages subpath.
// Bump VERSION when the file list changes, so old caches are cleaned up.
const VERSION = 'pg-v2';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css', 'icons/icon.svg', 'icons/icon-maskable.svg',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
  'js/app.js', 'js/registry.js', 'js/core/storage.js', 'js/core/audio.js', 'js/core/haptics.js', 'js/core/ui.js',
  ...['audio-lab', 'garage', 'garage-engine', 'generative-art', 'atmosphere', 'color-clash', 'lights-out', 'number-merge',
    'newtons-playground', 'kinetic-sand', 'fidget-lab', 'liquid-playground', 'liquid-sim'].map(m => `js/exp/${m}.js`),
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== 'pg-fonts').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Google Fonts: stale-while-revalidate so they keep working offline once seen.
  if (url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) {
    e.respondWith(caches.open('pg-fonts').then(async c => {
      const hit = await c.match(e.request);
      const net = fetch(e.request).then(r => { if (r.ok || r.type === 'opaque') c.put(e.request, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  // Same-origin: network first (so redeploys show up immediately), cache as the offline fallback.
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(hit => hit || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
