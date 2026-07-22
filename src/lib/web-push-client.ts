// Utilitários de cliente para inscrever / desinscrever o navegador
// em Web Push (VAPID) e enviar a assinatura ao backend.

import {
  getVapidPublicKey,
  savePushSubscription,
  deletePushSubscription,
} from "./push.functions";

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
  const { publicKey } = await getVapidPublicKey();

  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

  await savePushSubscription({
    data: {
      endpoint: sub.endpoint,
      p256dh: arrayBufferToBase64(sub.getKey("p256dh")),
      auth: arrayBufferToBase64(sub.getKey("auth")),
      userAgent: navigator.userAgent.slice(0, 500),
    },
  });

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
    await deletePushSubscription({ data: { endpoint } });
  } catch {}
}
