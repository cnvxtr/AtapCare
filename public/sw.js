// Service Worker — Web Push Atap Care
// Menampilkan notifikasi OS dari push (app terbuka maupun tertutup).
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch { /* payload bukan JSON — gunakan default */ }
  const title = data.title || 'Atap Care'
  const options = {
    body: data.body || '',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    data: { url: data.url || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of all) {
      if ('focus' in client) { client.focus(); if (client.url === url) return }
    }
    if (self.clients.openWindow) await self.clients.openWindow(url)
  })())
})
