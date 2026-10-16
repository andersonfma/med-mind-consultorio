// Service worker do Med Mind — Web Push.
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = {} }
  const title = data.title || 'Med Mind'
  const options = {
    body: data.body || '',
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: { url: data.url || '/feed' },
    tag: data.tag || undefined,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/feed'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ('focus' in c) { c.navigate(url); return c.focus() } }
      return self.clients.openWindow(url)
    })
  )
})
