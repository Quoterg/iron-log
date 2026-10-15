// Offline support. Hand-written to stay tiny.
// - App pages: cache-first, updated in the background (M39): a start never waits for the network;
//   a new version is fetched while the app runs, used at the next start, and the app is told so
//   it can offer to restart now. Without a cached copy (first visit): network.
// - Hashed assets (/assets/*): cache-first, they never change.
// - Food data: content-hashed files (data/*.<hash>.json) are cache-first — never re-downloaded;
//   anything else under data/ is stale-while-revalidate.
const CACHE = 'iron-log-v2';

// The policy and about pages are linked from Settings: available offline from the first run.
const PAGES = ['privacy.html', 'about.html'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PAGES)).catch(() => {}));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(pageCacheFirst(event, req));
  } else if (url.pathname.includes('/assets/') || /\/data\/[^/]+\.[0-9a-f]{8}\.json$/.test(url.pathname)) {
    event.respondWith(cacheFirst(req));
  } else {
    event.respondWith(staleWhileRevalidate(event, req));
  }
});

/** A newer page than the one being shown was fetched (M39); told to the app when it asks. */
let updateReady = false;

self.addEventListener('message', (e) => {
  // The app asks once it listens (a message sent before that would be lost).
  if (e.data?.type === 'update?' && updateReady) e.source?.postMessage({ type: 'update-ready' });
});

async function pageCacheFirst(event, req) {
  updateReady = false; // this load shows the newest page cached so far
  const cache = await caches.open(CACHE);
  // "?add" / "?water" (home-screen shortcuts) are the same page.
  const hit = (await cache.match(req, { ignoreSearch: true })) || (req.url.startsWith(self.registration.scope) && (await cache.match(self.registration.scope)));
  // Read the cached copy now: once it is handed to the page its body can't be read again.
  const cachedText = hit ? hit.clone().text() : null;
  const update = fetch(req).then(async (res) => {
    if (!res.ok) return res;
    const key = new URL(req.url);
    key.search = '';
    const old = cachedText ? await cachedText : null;
    const fresh = await res.clone().text();
    await cache.put(key.href, res.clone());
    if (old != null && old !== fresh) {
      updateReady = true;
      for (const c of await self.clients.matchAll({ type: 'window' })) c.postMessage({ type: 'update-ready' });
    }
    return res;
  });
  if (hit) {
    event.waitUntil(update.catch(() => {}));
    return hit;
  }
  return update.catch(() => Response.error());
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(event, req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const update = fetch(req).then((res) => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  });
  if (hit) {
    event.waitUntil(update.catch(() => {}));
    return hit;
  }
  return update;
}
