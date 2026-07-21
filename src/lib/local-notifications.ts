import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

export function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Solicita permissão para notificações locais.
 * - Em plataforma nativa (Android/iOS via Capacitor): usa LocalNotifications.
 * - No navegador: usa a Notification API do browser como fallback.
 */
export async function requestNotificationPermission(): Promise<
  "granted" | "denied" | "unsupported"
> {
  try {
    if (isNativePlatform()) {
      const res = await LocalNotifications.requestPermissions();
      return res.display === "granted" ? "granted" : "denied";
    }
  } catch (err) {
    console.warn("[notifications] native permission error", err);
  }

  if (typeof window !== "undefined" && "Notification" in window) {
    try {
      if (Notification.permission === "granted") return "granted";
      if (Notification.permission === "denied") return "denied";
      const r = await Notification.requestPermission();
      return r === "granted" ? "granted" : "denied";
    } catch {
      return "denied";
    }
  }
  return "unsupported";
}

export async function checkNotificationPermission(): Promise<
  "granted" | "denied" | "default" | "unsupported"
> {
  try {
    if (isNativePlatform()) {
      const res = await LocalNotifications.checkPermissions();
      if (res.display === "granted") return "granted";
      if (res.display === "denied") return "denied";
      return "default";
    }
  } catch {}
  if (typeof window !== "undefined" && "Notification" in window) {
    return Notification.permission as "granted" | "denied" | "default";
  }
  return "unsupported";
}

const REST_NOTIF_ID = 777001;

/**
 * Agenda uma notificação local para o momento em que o descanso termina.
 * Funciona com o app minimizado ou a tela bloqueada em Android/iOS.
 */
export async function scheduleRestFinishedNotification(
  seconds: number,
  exerciseName?: string,
): Promise<void> {
  const when = new Date(Date.now() + Math.max(1, seconds) * 1000);
  const body = exerciseName
    ? `Hora de iniciar a próxima série de ${exerciseName}.`
    : "Hora de iniciar a próxima série.";

  if (isNativePlatform()) {
    try {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") return;
      await LocalNotifications.schedule({
        notifications: [
          {
            id: REST_NOTIF_ID,
            title: "Descanso concluído!",
            body,
            schedule: { at: when, allowWhileIdle: true },
            smallIcon: "ic_stat_icon_config_sample",
            sound: undefined,
            channelId: "rest-timer",
          },
        ],
      });
    } catch (err) {
      console.warn("[notifications] schedule error", err);
    }
    return;
  }
  // Web: não há agendamento confiável em background — o RestTimer dispara
  // uma Notification imediatamente quando o timer termina como fallback.
}

export async function cancelRestNotification(): Promise<void> {
  if (isNativePlatform()) {
    try {
      await LocalNotifications.cancel({
        notifications: [{ id: REST_NOTIF_ID }],
      });
    } catch {}
  }
}

let channelEnsured = false;
export async function ensureRestChannel(): Promise<void> {
  if (!isNativePlatform() || channelEnsured) return;
  try {
    await LocalNotifications.createChannel({
      id: "rest-timer",
      name: "Descanso entre séries",
      description: "Avisa quando o tempo de descanso acaba",
      importance: 5,
      visibility: 1,
      vibration: true,
      sound: undefined,
    });
    channelEnsured = true;
  } catch {}
}
