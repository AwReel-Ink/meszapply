/*
 * MesZapply — service worker
 * ------------------------------------------------------------
 * Garde MesZapply en mémoire pour un démarrage instantané et hors ligne.
 * Le numéro de version vient de js/version.js : inutile de modifier ce fichier.
 *
 * Important : toutes tes applis partagent l'adresse awreel-ink.github.io, donc
 * le même espace de cache. Ce service worker ne touche QUE ses propres caches
 * (ceux qui commencent par « meszapply- »).
 */
importScripts('./js/version.js');

const VERSION = self.MZ_VERSION || '0';
const SHELL_CACHE = `meszapply-shell-${VERSION}`;
const DATA_CACHE = 'meszapply-data';
const FONT_CACHE = 'meszapply-fonts';
const ICON_CACHE = 'meszapply-icons';

const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/version.js',
  './js/config.js',
  './js/db.js',
  './js/github.js',
  './js/store.js',
  './js/prefs.js',
  './js/meta.js',
  './js/ui.js',
  './js/windows.js',
  './js/bubble.js',
  './js/gallery.js',
  './js/sortable.js',
  './js/actions.js',
  './js/appform.js',
  './js/manage.js',
  './js/settings.js',
  './js/sw-client.js',
  './js/main.js',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(k => k.startsWith('meszapply-shell-') && k !== SHELL_CACHE)
      .map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

const scopePath = new URL(self.registration.scope).pathname;

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Polices Google : gardées pour le hors ligne
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(req, FONT_CACHE));
    return;
  }

  if (url.origin !== self.location.origin) return; // API GitHub, etc. : réseau direct

  // Fichiers de MesZapply
  if (url.pathname.startsWith(scopePath)) {
    if (url.pathname === `${scopePath}data/apps.json`) {
      event.respondWith(networkFirst(req, DATA_CACHE, `${scopePath}data/apps.json`));
      return;
    }
    if (req.mode === 'navigate') {
      event.respondWith(
        caches.match('./index.html', { cacheName: SHELL_CACHE })
          .then(hit => hit || fetch(req))
          .catch(() => caches.match('./index.html'))
      );
      return;
    }
    event.respondWith(
      caches.match(req, { cacheName: SHELL_CACHE, ignoreSearch: true }).then(hit => hit || fetch(req))
    );
    return;
  }

  // Icônes des autres applis affichées dans la galerie : gardées pour le hors ligne
  if (req.destination === 'image') {
    event.respondWith(staleWhileRevalidate(req, ICON_CACHE));
  }
  // Le reste (pages et manifests des autres applis) passe directement par le réseau
});

async function networkFirst(req, cacheName, key) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(key, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(key);
    if (hit) return hit;
    throw e;
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const network = fetch(req).then(res => {
    if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
    return res;
  }).catch(() => hit);
  return hit || network;
}
