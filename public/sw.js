// Service worker: recibe las notificaciones push y abre la sección correspondiente al tocarlas.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (e) => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch { d = { title: 'Notificación', body: e.data ? e.data.text() : '' } }
  e.waitUntil(self.registration.showNotification(d.title || 'Notificación', {
    body: d.body || '',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    data: { url: d.url || '/app/notificaciones' },
    vibrate: [80, 40, 80],
  }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || '/app/notificaciones'
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      if ('focus' in c) { if ('navigate' in c) c.navigate(url); return c.focus() }
    }
    return self.clients.openWindow(url)
  }))
})
