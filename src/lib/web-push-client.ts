import { callServer } from "@/lib/server-bridge";
// Utilitários de cliente para inscrever / desinscrever o navegador
// em Web Push (VAPID) e enviar a assinatura ao backend.

import {
  getVapidPublicKey,
  savePushSubscription,
  deletePushSubscription,
  sendTestPush,
} from "./push.functions";

// `callServer` já resolve a diferença entre os domínios: no canônico executa a
// server function; no espelho (site estático) chama a mesma ação pela ponte.

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

async function ensureRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

/** Inscreve o navegador em Web Push e salva a assinatura no backend. */
export async function subscribeToWebPush(): Promise<PushSubscription> {
  if (!isPushSupported()) throw new Error("Web Push não é suportado neste navegador.");
  if (Notification.permission !== "granted") {
    throw new Error("Permissão de notificação necessária.");
  }

  const reg = await ensureRegistration();
  const { publicKey } = await callServer<{ publicKey: string | null }>("push.vapid", getVapidPublicKey);
  if (!publicKey) {
    throw new Error("Servidor não possui VAPID_PUBLIC_KEY configurada. Web Push desativado.");
  }

  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
    }));

  const payload = {
    endpoint: sub.endpoint,
    p256dh: arrayBufferToBase64(sub.getKey("p256dh")),
    auth: arrayBufferToBase64(sub.getKey("auth")),
    userAgent: navigator.userAgent.slice(0, 500),
  };
  await callServer("push.save", savePushSubscription, payload);

  return sub;
}

/** Cancela a assinatura local e remove do backend. */
export async function unsubscribeFromWebPush(): Promise<void> {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration("/");
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  try {
    await sub.unsubscribe();
  } catch {}
  try {
    await callServer("push.delete", deletePushSubscription, { endpoint });
  } catch {}
}

/**
 * Garante que a assinatura Web Push está ativa e registrada no backend.
 * Chamado ao abrir o app: se o navegador tem permissão e o usuário optou
 * por push, revalida a assinatura. Caso o servidor de push tenha invalidado
 * (404/410) — o que faz o dispatcher apagá-la — recria uma nova.
 */
export async function ensureWebPushSubscribed(): Promise<void> {
  if (!isPushSupported()) return;
  if (Notification.permission !== "granted") return;
  try {
    const reg = await ensureRegistration();
    const existing = await reg.pushManager.getSubscription();
    // Se já existe, apenas re-salva no backend (upsert) para garantir persistência.
    // Se não existe (ou foi limpa), cria uma nova.
    if (existing) {
      const payload = {
        endpoint: existing.endpoint,
        p256dh: arrayBufferToBase64(existing.getKey("p256dh")),
        auth: arrayBufferToBase64(existing.getKey("auth")),
        userAgent: navigator.userAgent.slice(0, 500),
      };
      await callServer("push.save", savePushSubscription, payload);
    } else {
      await subscribeToWebPush();
    }
  } catch (err) {
    console.warn("[push] ensure subscribe failed", err);
  }
}

/**
 * Recria a assinatura do zero neste aparelho. Útil quando o navegador tem
 * permissão mas o push não chega (assinatura antiga/expirada, chave VAPID
 * trocada, app reinstalado). Remove a antiga no backend e no navegador.
 */
export async function resubscribeWebPush(): Promise<void> {
  if (!isPushSupported()) throw new Error("Web Push não é suportado neste navegador.");
  if (Notification.permission !== "granted") {
    throw new Error("Permissão de notificação necessária.");
  }
  const reg = await ensureRegistration();
  const old = await reg.pushManager.getSubscription();
  if (old) {
    const endpoint = old.endpoint;
    try { await old.unsubscribe(); } catch {}
    try { await callServer("push.delete", deletePushSubscription, { endpoint }); } catch {}
  }
  await subscribeToWebPush();
}

export type TestPushResult = {
  devices: number;
  sent: number;
  failed: number;
  removed: number;
  errors: string[];
};

/** Pede ao servidor que envie uma notificação de teste para este usuário. */
export async function sendTestNotification(): Promise<TestPushResult> {
  return callServer<TestPushResult>("push.test", sendTestPush);
}
