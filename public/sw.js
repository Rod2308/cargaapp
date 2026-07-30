// Service Worker do Carga.
// Responsável por:
//  - receber Web Push (evento "push") e exibir a notificação nativa do SO,
//    mesmo com a aba fechada ou o celular bloqueado.
//  - manter um alarme próprio do descanso (mensagem "rest-schedule"), que
//    funciona offline e dispara na hora exata, sem depender do servidor.
//  - reagir ao clique da notificação abrindo/focando o app.

const REST_TAG = "rest-timer";
// Evita notificação duplicada quando o push do servidor chega logo depois
// (ou antes) do alarme local do próprio service worker.
const DEDUPE_WINDOW_MS = 90 * 1000;
// Push de descanso muito atrasado (servidor lento / device offline) é
// descartado: avisar "descanso acabou" 10 minutos depois só atrapalha.
const MAX_REST_PUSH_LATENESS_MS = 5 * 60 * 1000;

let restTimeoutId = null;
let lastRestShownAt = 0;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

async function showRestNotification(title, body) {
  const now = Date.now();
  if (now - lastRestShownAt < DEDUPE_WINDOW_MS) return;
  lastRestShownAt = now;
  await self.registration.showNotification(title || "Descanso acabou! 💪", {
    body: body || "Hora de iniciar a próxima série.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: REST_TAG,
    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate: [180, 90, 180, 90, 300],
    data: { url: "/", type: "rest-finished" },
  });
}

function clearRestTimer() {
  if (restTimeoutId !== null) {
    clearTimeout(restTimeoutId);
    restTimeoutId = null;
  }
}

// Alarme local do descanso: funciona sem internet e sem depender do cron.
self.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg.type === "rest-schedule") {
    clearRestTimer();
    const fireAt = Number(msg.fireAt) || 0;
    const delay = Math.max(0, fireAt - Date.now());
    // Reinicia a janela de dedupe: este é um novo descanso.
    lastRestShownAt = 0;
    const title = msg.title || "Descanso acabou! 💪";
    const body = msg.body || "Hora de iniciar a próxima série.";
    event.waitUntil(
      new Promise((resolve) => {
        restTimeoutId = setTimeout(() => {
          restTimeoutId = null;
          showRestNotification(title, body).finally(resolve);
        }, delay);
      }),
    );
    return;
  }
  if (msg.type === "rest-cancel") {
    clearRestTimer();
    lastRestShownAt = Date.now();
    event.waitUntil(
      self.registration.getNotifications({ tag: REST_TAG }).then((list) => {
        list.forEach((n) => n.close());
      }),
    );
  }
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Carga", body: event.data ? event.data.text() : "" };
  }

  const data = payload.data || {};

  // Push de fim de descanso: passa pelo mesmo caminho com dedupe + descarte
  // de avisos atrasados demais para serem úteis.
  if (data.type === "rest-finished" || payload.tag === REST_TAG) {
    const fireAt = Number(data.fireAt) || 0;
    if (fireAt && Date.now() - fireAt > MAX_REST_PUSH_LATENESS_MS) return;
    clearRestTimer();
    event.waitUntil(showRestNotification(payload.title, payload.body));
    return;
  }

  const title = payload.title || "Carga";
  const url = data.url || payload.url || "/";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icon-192.png",
    badge: payload.badge || "/icon-192.png",
    tag: payload.tag,
    data: { ...data, url },
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
