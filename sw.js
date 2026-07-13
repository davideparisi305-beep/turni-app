/* Service worker — guscio offline della PWA.
 * Strategia: cache-first per i file dell'app (shell), network-only per l'API
 * (dati sempre freschi). Cambia CACHE quando aggiorni i file per forzare
 * l'aggiornamento sui telefoni già installati. */
const CACHE = 'turni3-shell-v5';
const SHELL = [
  '.',
  'index.html',
  'styles.css',
  'app.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Le chiamate all'API (Apps Script) non passano dalla cache: dati sempre live.
  if (url.hostname.indexOf('script.google') >= 0 || url.hostname.indexOf('googleusercontent') >= 0) return;
  if (e.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  // NETWORK-FIRST per i file dell'app: gli aggiornamenti si vedono subito
  // ricaricando. La cache serve solo da fallback offline.
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then((hit) => hit || caches.match('index.html')))
  );
});
