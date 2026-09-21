/* Conjure - the service worker. What lets an installed Conjure open with no
 * internet, and keep opening if playconjure.com is ever down.
 *
 * Published beside the app at the site root (tools/github_sync.py SITE_FILES)
 * and registered by src/catalog/cat_pwa.js - only on https, never from a file
 * opened off disk and never on the check suite's local servers unless a check
 * asks for it. It sits at the root because a service worker only looks after
 * pages at or below its own address.
 *
 * FOUR KINDS OF THING, FOUR RULES:
 *
 *   the app itself      card_catalog.html, the home page, the manifest, icons
 *                       NETWORK FIRST. Online you always get the newest app -
 *                       revalidated against the site, so an unchanged app costs
 *                       a 304, not 15 MB. The copy kept here is used when the
 *                       network fails, when it has not answered in 8 seconds,
 *                       or when the SITE answers with an error: a 404 from a
 *                       site that has gone is exactly the case this is for.
 *   card art            cdn.jsdelivr.net/.../art/
 *                       KEPT AS SEEN. A picture shown once is shown from here
 *                       from then on, and fetched again in the background once
 *                       it is three days old - so republished art still arrives.
 *                       "Save all card art" in the Download Website dialog fills
 *                       this in one go (the page writes the same cache).
 *   published data      raw.githubusercontent.com (cards.json and friends)
 *                       NETWORK FIRST, kept copy when offline.
 *   fonts               Google Fonts. Kept, refreshed in the background.
 *
 * Everything else - the GitHub API that Owner Sync publishes through, the
 * relay's WebSocket, the Discord link - is not touched at all.
 *
 * ⚠ ART IS FETCHED WITH mode:'cors'. An <img> asks in no-cors mode and gets an
 * OPAQUE response, which a cache can hold but Chrome charges several MB of
 * quota for, per picture, and which a canvas cannot draw from. jsDelivr sends
 * Access-Control-Allow-Origin: *, so asking properly costs nothing.
 *
 * ⚠ BUMP THE VERSION ONLY TO THROW THE CACHES AWAY. Nothing needs a bump for a
 * new app to reach people - network-first does that on its own. A new name
 * here deletes every picture everyone has kept, on their next visit.
 */
'use strict';

const APP = 'conjure-app-v1';
const ART = 'conjure-art-v1';      /* ⚠ cat_pwa.js writes this one too - same name */
const DATA = 'conjure-data-v1';
const FONT = 'conjure-font-v1';
const KEEP = [APP, ART, DATA, FONT];

const SHELL = ['card_catalog.html', 'index.html', 'manifest.webmanifest',
               'pwa/icon-192.png', 'pwa/icon-512.png'];
const APP_PAGE = 'card_catalog.html';
const NET_WAIT_MS = 8000;
const ART_STALE_MS = 3 * 24 * 3600 * 1000;

const here = p => new URL(p, self.registration.scope).href;
/* A kept page is filed without its query and hash: the app keeps the open deck
   and the browse filters in the address, and every one of those is the same
   file. */
const bare = u => { const x = new URL(u); return x.origin + x.pathname; };

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(APP).then(c => Promise.all(SHELL.map(p =>
    fetch(here(p), { cache: 'no-cache' })
      .then(r => (r.ok ? c.put(here(p), r) : null))
      .catch(() => null))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', ev => {
  ev.waitUntil(caches.keys()
    .then(names => Promise.all(names
      .filter(n => n.startsWith('conjure-') && KEEP.indexOf(n) < 0)
      .map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (url.pathname.endsWith('/sw.js')) return;
    if (req.mode === 'navigate' || /\.(html|webmanifest|png)$/i.test(url.pathname))
      ev.respondWith(appFirst(ev, req));
    return;
  }
  if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.indexOf('/art/') >= 0) {
    ev.respondWith(artKept(ev, req));
    return;
  }
  if (url.hostname === 'raw.githubusercontent.com') {
    ev.respondWith(dataFirst(ev, req));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    ev.respondWith(fontKept(ev, req));
  }
});

/* The kept copy of a page: its own, then the directory's index.html, then -
   for a navigation - the app itself, which is what an installed Conjure opens. */
async function keptPage(cache, req) {
  const key = bare(req.url);
  return (await cache.match(key))
      || (key.endsWith('/') ? await cache.match(key + 'index.html') : null)
      || (req.mode === 'navigate' ? await cache.match(here(APP_PAGE)) : null);
}

async function appFirst(ev, req) {
  const cache = await caches.open(APP);
  const net = fetch(req).then(r => ({ r }), e => ({ e }));
  const slow = new Promise(res => setTimeout(() => res({ slow: true }), NET_WAIT_MS));
  let got = await Promise.race([net, slow]);
  if (got.slow) {
    const kept = await keptPage(cache, req);
    if (kept) return kept;                  /* the site is hanging; we have it */
    got = await net;
  }
  if (got.r && got.r.ok) {
    const res = got.r;
    const key = bare(req.url);
    const copy = res.clone();
    /* Written only when it changed: the app is 15 MB, and a revalidated copy
       comes back as a full 200 to this code whatever the wire carried. */
    ev.waitUntil(cache.match(key).then(old => {
      const tag = res.headers.get('etag');
      if (old && tag && old.headers.get('etag') === tag) return null;
      return cache.put(key, copy);
    }).catch(() => null));
    return res;
  }
  /* Offline, or the site answered with an error page. */
  const kept = await keptPage(cache, req);
  if (kept) return kept;
  if (got.r) return got.r;
  throw got.e;
}

async function artKept(ev, req) {
  const cache = await caches.open(ART);
  const key = bare(req.url);
  const hit = await cache.match(key);
  const fresh = () => fetch(key, { mode: 'cors', credentials: 'omit' })
    .then(r => { if (r.ok) return cache.put(key, r.clone()).then(() => r); return r; });
  if (hit) {
    const age = Date.now() - Date.parse(hit.headers.get('date') || '');
    if (!(age < ART_STALE_MS)) ev.waitUntil(fresh().catch(() => null));
    return hit;
  }
  try {
    return await fresh();
  } catch (e) {
    return fetch(req);        /* CORS refused: what the page asked for, not kept */
  }
}

async function dataFirst(ev, req) {
  const cache = await caches.open(DATA);
  const key = bare(req.url);
  try {
    const res = await fetch(req);
    if (res.ok && res.type !== 'opaque') ev.waitUntil(cache.put(key, res.clone()).catch(() => null));
    return res;
  } catch (e) {
    const hit = await cache.match(key);
    if (hit) return hit;
    throw e;
  }
}

async function fontKept(ev, req) {
  const cache = await caches.open(FONT);
  const hit = await cache.match(req.url);
  const net = fetch(req).then(r => {
    if (r.ok || r.type === 'opaque') ev.waitUntil(cache.put(req.url, r.clone()).catch(() => null));
    return r;
  });
  if (hit) { ev.waitUntil(net.catch(() => null)); return hit; }
  return net;
}
