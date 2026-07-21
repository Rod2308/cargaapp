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

/** Solicita permissão para notificações locais nativas. */
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
            smallIcon: "ic_stat_icon_config_sample",
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
  }
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
