// Replace any previously installed app shell, then step out of the way.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.map((key) => caches.delete(key)))
    const clients = await self.clients.matchAll({ type: 'window' })
    await self.registration.unregister()
    await Promise.all(clients.map((client) => client.navigate(client.url)))
  })())
})
