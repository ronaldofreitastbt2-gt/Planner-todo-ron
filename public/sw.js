// Service Worker for Meu Planner PWA
// Cache-first strategy for static assets (production only)
const IS_DEV = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1'
const CACHE_NAME = 'planner-v5'
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Pre-cache known static assets
      await cache.addAll(ASSETS).catch(() => {})

      // Dynamically discover hashed bundles from index.html
      try {
        const res = await fetch('/index.html')
        const html = await res.text()
        const urls = []
        const scriptRe = /src="([^"]+)"/g
        const linkRe = /href="([^"]+\.css)"/g
        let m
        while ((m = scriptRe.exec(html))) urls.push(m[1])
        while ((m = linkRe.exec(html))) urls.push(m[1])
        await Promise.all(urls.map((u) => cache.add(u).catch(() => {})))
      } catch {
        // index.html not available yet
      }
    }),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      )
    }),
  )
    // In dev, also unregister this SW on activation
  if (IS_DEV) {
    self.registration.unregister()
  }
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  // In development, bypass SW entirely — let Vite handle everything
  if (IS_DEV) return

  // Skip non-GET requests
  if (event.request.method !== 'GET') return

  // Handle navigation requests (HTML) with network-first
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request).then((r) => r || caches.match('/'))
      }),
    )
    return
  }

  // For static assets, use stale-while-revalidate
  if (
    event.request.url.includes('/assets/') ||
    event.request.url.includes('/icons/') ||
    event.request.url.includes('/@vite/') ||
    event.request.url.includes('/node_modules/')
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cached) => {
          const fetchPromise = fetch(event.request)
            .then((response) => {
              if (response.ok) {
                cache.put(event.request, response.clone())
              }
              return response
            })
            .catch(() => cached)
          return cached || fetchPromise
        })
      }),
    )
    return
  }

  // Default: network-first
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request)
    }),
  )
})

// Push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return

  event.waitUntil(
    event.data
      .json()
      .catch(() => event.data.text().then((text) => ({ title: 'Meu Planner', body: text })))
      .then((payload) => {
        const options = {
          body: payload.body || '',
          icon: payload.icon || '/icons/icon-192x192.png',
          badge: payload.badge || '/icons/icon-192x192.png',
          vibrate: payload.vibrate || [300, 200, 300],
          tag: payload.tag || 'planner',
          requireInteraction: true,
          actions: [
            { action: 'open', title: 'Abrir' },
            { action: 'dismiss', title: 'Dispensar' },
          ],
        }
        return self.registration.showNotification(
          payload.title || 'Meu Planner',
          options
        )
      }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'dismiss') return

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focar na janela existente ou abrir nova
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      return self.clients.openWindow('/')
    }),
  )
})

// Allow the client to trigger skipWaiting
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
