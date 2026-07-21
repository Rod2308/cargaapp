import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

const REST_CHANNEL_ID = "rest-timer";

export function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** Solicita permissão para notificações locais nativas ou do navegador. */
export async function requestNotificationPermission(): Promise<
  "granted" | "denied" | "unsupported"
> {
  try {
    if (isNativePlatform()) {
      await ensureRestChannel();
      const res = await LocalNotifications.requestPermissions();
      return res.display === "granted" ? "granted" : "denied";
    }
  } catch (err) {
    console.warn("[notifications] native permission error", err);
  }
  // Fallback web: Notification API do navegador.
  if (typeof window !== "undefined" && "Notification" in window) {
    try {
      const res = await Notification.requestPermission();
      return res === "granted" ? "granted" : "denied";
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
    return Notification.permission;
  }
  return "unsupported";
}

const REST_NOTIF_ID = 777001;
let webTimeoutId: ReturnType<typeof setTimeout> | null = null;

/**
 * Agenda uma notificação local para o momento em que o descanso termina.
 * Nativo (Capacitor): funciona com app minimizado ou tela bloqueada.
 * Web: usa setTimeout + Notification/ServiceWorker.showNotification — funciona
 * enquanto a aba não é descartada pelo SO.
 */
export async function scheduleRestFinishedNotification(
  seconds: number,
  exerciseName?: string,
): Promise<void> {
  const ms = Math.max(1, seconds) * 1000;
  const when = new Date(Date.now() + ms);
  const body = exerciseName
    ? `Hora de iniciar a próxima série de ${exerciseName}.`
    : "Hora de iniciar a próxima série.";

  if (isNativePlatform()) {
    try {
      await ensureRestChannel();
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") return;
      await ensureExactAlarmPermissionIfAvailable();
      await cancelRestNotification();
      await LocalNotifications.schedule({
        notifications: [
          {
            id: REST_NOTIF_ID,
            title: "Descanso acabou!",
            body: `${body} 💪`,
            schedule: { at: when, allowWhileIdle: true },
            smallIcon: "ic_stat_rest_timer",
            sound: "default",
            channelId: REST_CHANNEL_ID,
            autoCancel: true,
          },
        ],
      });
    } catch (err) {
      console.warn("[notifications] schedule error", err);
    }
    return;
  }

  // Fallback web
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  cancelWebRestNotification();
  webTimeoutId = setTimeout(() => {
    void showWebRestNotification(body);
  }, ms);
}

async function showWebRestNotification(body: string): Promise<void> {
  const title = "Descanso acabou! 💪";
  const options: NotificationOptions = {
    body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: "rest-timer",
    requireInteraction: true,
    silent: false,
  };
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(title, options);
        return;
      }
    }
    new Notification(title, options);
  } catch (err) {
    console.warn("[notifications] web show error", err);
  }
}

function cancelWebRestNotification(): void {
  if (webTimeoutId !== null) {
    clearTimeout(webTimeoutId);
    webTimeoutId = null;
  }
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    void navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;
      void reg.getNotifications({ tag: "rest-timer" }).then((list) => {
        list.forEach((n) => n.close());
      });
    });
  }
}

async function ensureExactAlarmPermissionIfAvailable(): Promise<void> {
  try {
    const native = LocalNotifications as typeof LocalNotifications & {
      checkExactNotificationSetting?: () => Promise<{ exact_alarm?: string }>;
    };
    await native.checkExactNotificationSetting?.();
  } catch {
    // Android pode negar alarmes exatos; neste caso o plugin ainda agenda a
    // notificação local, apenas sem garantir precisão absoluta no modo Doze.
  }
}

export async function cancelRestNotification(): Promise<void> {
  if (isNativePlatform()) {
    try {
      await LocalNotifications.cancel({
        notifications: [{ id: REST_NOTIF_ID }],
      });
    } catch {}
    return;
  }
  cancelWebRestNotification();
}

let channelEnsured = false;
export async function ensureRestChannel(): Promise<void> {
  if (!isNativePlatform() || channelEnsured) return;
  try {
    await LocalNotifications.createChannel({
      id: REST_CHANNEL_ID,
      name: "Descanso entre séries",
      description: "Avisa quando o tempo de descanso acaba",
      importance: 5,
      visibility: 1,
      vibration: true,
    });
    channelEnsured = true;
  } catch {}
}
