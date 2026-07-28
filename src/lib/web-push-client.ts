import { callServer } from "@/lib/server-bridge";
// Utilitários de cliente para inscrever / desinscrever o navegador
// em Web Push (VAPID) e enviar a assinatura ao backend.

import {
  getVapidPublicKey,
  savePushSubscription,
  deletePushSubscription,
} from "./push.functions";
import {
  fetchVapidPublicKeyClient,
  savePushSubscriptionClient,
  deletePushSubscriptionClient,
} from "./push-client-fallback";

// No domínio espelho (site estático) as server functions não existem e a
// chamada falha com erro de rede/404/HTML. Nesses casos repetimos a mesma
// operação direto pelo cliente do backend, para o comportamento ficar
// idêntico nos dois domínios.
async function withFallback<T>(primary: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  try {
    return await primary();
  } catch (err) {
    console.warn("[push] server function indisponível, usando fallback do cliente", err);
    return await fallback();
  }
}

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
  const { publicKey } = await withFallback(
    () => callServer<{ publicKey: string }>("push.vapid", getVapidPublicKey),
    async () => ({ publicKey: await fetchVapidPublicKeyClient() }),
  );

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
  await withFallback(
    () => callServer("push.save", savePushSubscription, payload).then(() => undefined),
    () => savePushSubscriptionClient(payload).then(() => undefined),
  );

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
    await withFallback(
      () => callServer("push.delete", deletePushSubscription, { endpoint }).then(() => undefined),
      () => deletePushSubscriptionClient(endpoint).then(() => undefined),
    );
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
      await withFallback(
        () => callServer("push.save", savePushSubscription, payload).then(() => undefined),
        () => savePushSubscriptionClient(payload).then(() => undefined),
      );
    } else {
      await subscribeToWebPush();
    }
  } catch (err) {
    console.warn("[push] ensure subscribe failed", err);
  }
}
