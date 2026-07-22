// Service Worker do Carga.
// Responsável por:
//  - receber Web Push (evento "push") e exibir a notificação nativa do SO,
//    mesmo com a aba fechada ou o celular bloqueado.
//  - reagir ao clique da notificação abrindo/focando o app.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Carga", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Carga";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icon-192.png",
    badge: payload.badge || "/icon-192.png",
    tag: payload.tag,
    data: { url: payload.url || "/" },
    requireInteraction: payload.requireInteraction === true,
    silent: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        try {
          await client.focus();
          if ("navigate" in client) await client.navigate(target);
          return;
        } catch {}
      }
      await self.clients.openWindow(target);
    })(),
  );
});
