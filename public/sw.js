// Service Worker do Carga.
// Responsável por:
//  - receber Web Push (evento "push") e exibir a notificação nativa do SO,
//    mesmo com a aba fechada ou o celular bloqueado.
//  - manter um alarme de descanso PERSISTENTE (IndexedDB) que funciona
//    offline. No celular o service worker é encerrado depois de alguns
//    segundos de inatividade, então além do setTimeout guardamos o horário
//    em disco e reavaliamos em qualquer evento que acorde o worker
//    (message, push, fetch, sync, periodicsync, notificationclick).
//  - reagir ao clique da notificação abrindo/focando o app.

const REST_TAG = "rest-timer";
// Evita notificação duplicada quando o push do servidor chega logo depois
// (ou antes) do alarme local do próprio service worker.
const DEDUPE_WINDOW_MS = 90 * 1000;
// Push de descanso muito atrasado (servidor lento / device offline) é
// descartado: avisar "descanso acabou" 10 minutos depois só atrapalha.
const MAX_REST_PUSH_LATENESS_MS = 5 * 60 * 1000;
// Alarme persistido também expira: se o worker só acordar muito depois,
// não faz sentido avisar de um descanso antigo.
const MAX_ALARM_LATENESS_MS = 10 * 60 * 1000;

const DB_NAME = "carga-sw";
const STORE = "state";
const ALARM_KEY = "rest-alarm";

let restTimeoutId = null;
let lastRestShownAt = 0;

// ---------------------------------------------------------------- IndexedDB

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function idbSet(key, value) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {}
}

async function idbDelete(key) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {}
}

// ------------------------------------------------------------------- ciclo

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      // O worker pode ter sido reiniciado com um descanso em andamento.
      await restoreAlarm();
    })(),
  );
});

// -------------------------------------------------------------- notificação

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

async function clearAlarm() {
  clearRestTimer();
  await idbDelete(ALARM_KEY);
}

/**
 * Reavalia o alarme guardado em disco. Chamado em TODO evento que acorda o
 * service worker — é isso que faz o aviso funcionar offline mesmo depois de
 * o worker ter sido encerrado pelo sistema.
 */
async function restoreAlarm() {
  const alarm = await idbGet(ALARM_KEY);
  if (!alarm || !alarm.fireAt) return;

  const delay = alarm.fireAt - Date.now();

  if (delay <= 0) {
    await idbDelete(ALARM_KEY);
    // Atrasado demais para ser útil: descarta em silêncio.
    if (-delay > MAX_ALARM_LATENESS_MS) return;
    await showRestNotification(alarm.title, alarm.body);
    return;
  }

  // Ainda no futuro: (re)arma o timer enquanto este worker estiver vivo.
  clearRestTimer();
  restTimeoutId = setTimeout(() => {
    restTimeoutId = null;
    void (async () => {
      await idbDelete(ALARM_KEY);
      await showRestNotification(alarm.title, alarm.body);
    })();
  }, delay);
}

// --------------------------------------------------------------- mensagens

self.addEventListener("message", (event) => {
  const msg = event.data || {};

  if (msg.type === "rest-schedule") {
    const fireAt = Number(msg.fireAt) || 0;
    const title = msg.title || "Descanso acabou! 💪";
    const body = msg.body || "Hora de iniciar a próxima série.";
    // Reinicia a janela de dedupe: este é um novo descanso.
    lastRestShownAt = 0;
    clearRestTimer();
    event.waitUntil(
      (async () => {
        await idbSet(ALARM_KEY, { fireAt, title, body });
        await restoreAlarm();
      })(),
    );
    return;
  }

  if (msg.type === "rest-cancel") {
    lastRestShownAt = Date.now();
    event.waitUntil(
      (async () => {
        await clearAlarm();
        const list = await self.registration.getNotifications({ tag: REST_TAG });
        list.forEach((n) => n.close());
      })(),
    );
    return;
  }

  // Heartbeat enviado pela página: mantém o worker vivo e reavalia o alarme.
  if (msg.type === "rest-ping") {
    event.waitUntil(restoreAlarm());
  }
});

// ----------------------------------------------------- eventos que acordam

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
    const wait = fireAt ? fireAt - Date.now() : 0;
    event.waitUntil(
      (async () => {
        // O servidor envia o push com até 90s de antecedência (o cron roda a
        // cada minuto). Aqui seguramos o worker acordado até o instante exato
        // do fim do descanso — é isso que faz o aviso chegar na hora certa
        // mesmo com o celular bloqueado.
        if (wait > 0) {
          // Não apagamos o alarme local antes da hora: se o sistema encerrar
          // o worker durante a espera, o alarme persistido ainda avisa.
          await new Promise((resolve) => setTimeout(resolve, Math.min(wait, 150000)));
        }
        await clearAlarm();
        await showRestNotification(payload.title, payload.body);
      })(),

    );
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

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);
      // Qualquer push é uma oportunidade de conferir o alarme pendente.
      await restoreAlarm();
    })(),
  );
});

// Qualquer requisição da página acorda o worker: aproveitamos para conferir
// se o descanso já venceu. Não interceptamos nada (pass-through).
self.addEventListener("fetch", (event) => {
  if (restTimeoutId === null) {
    event.waitUntil(restoreAlarm());
  }
});

self.addEventListener("sync", (event) => {
  if (event.tag === "rest-alarm") event.waitUntil(restoreAlarm());
});

self.addEventListener("periodicsync", (event) => {
  if (event.tag === "rest-alarm") event.waitUntil(restoreAlarm());
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
