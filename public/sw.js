// Service worker: lets the app open and run with no connection.
//
// - Pages: network first, falling back to the cached app shell, so a
//   deploy is picked up as soon as you're online.
// - Built assets (/assets/*, content-hashed): cache first.
// - Icons, fonts and uploaded pictures (Supabase Storage public URLs):
//   served from cache while a fresh copy is fetched in the background.
// - Supabase data and realtime are never cached here; the app keeps its
//   own offline copy of table rows (src/lib/offline.js).

const VERSION = 'v1'
const SHELL = `shell-${VERSION}`
const ASSETS = `assets-${VERSION}`
const RUNTIME = `runtime-${VERSION}`
const MAX_ASSETS = 80
const MAX_RUNTIME = 300

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL)
      const response = await fetch('/index.html', { cache: 'no-cache' })
      await shell.put('/index.html', response.clone())
      // Precache the scripts and styles this build's page loads, so the
      // very first visit is enough to work offline.
      const html = await response.text()
      const urls = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1])
      const assets = await caches.open(ASSETS)
      await assets.addAll([...new Set(urls)])
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL, ASSETS, RUNTIME])
      for (const name of await caches.keys()) {
        if (!keep.has(name)) await caches.delete(name)
      }
      await self.clients.claim()
    })(),
  )
})

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  for (const request of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(request)
}

async function networkFirstPage(request) {
  const shell = await caches.open(SHELL)
  try {
    const response = await fetch(request)
    if (response.ok) await shell.put('/index.html', response.clone())
    return response
  } catch {
    return (await shell.match('/index.html')) || Response.error()
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    await cache.put(request, response.clone())
    trim(ASSETS, MAX_ASSETS)
  }
  return response
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(RUNTIME)
  const cached = await cache.match(event.request)
  const refresh = fetch(event.request)
    .then(async (response) => {
      // Opaque responses (cross-origin, no CORS) are fine for <img>.
      if (response.ok || response.type === 'opaque') {
        await cache.put(event.request, response.clone())
        trim(RUNTIME, MAX_RUNTIME)
      }
      return response
    })
    .catch(() => cached || Response.error())
  if (cached) {
    event.waitUntil(refresh)
    return cached
  }
  return refresh
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (request.mode === 'navigate' && url.origin === self.location.origin && !url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstPage(request))
    return
  }
  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/assets/')) event.respondWith(cacheFirst(request))
    else if (/\.(png|svg|webmanifest|ico)$/.test(url.pathname)) event.respondWith(staleWhileRevalidate(event))
    return
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(event))
    return
  }
  // Session recordings are big (pieces up to 45MB) and fetched whole to
  // play or export: caching them would also download each one twice.
  if (url.pathname.includes('/storage/v1/object/public/session-audio/')) return
  if (url.pathname.includes('/storage/v1/object/public/')) {
    event.respondWith(staleWhileRevalidate(event))
  }
})
