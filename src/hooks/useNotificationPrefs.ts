import { useCallback, useEffect, useState } from "react";

export type NotificationPrefs = {
  // Grupos / desafios
  rankChange: boolean;
  deadline: boolean;
  otherCheckins: boolean;
  groupMessages: boolean;
  groupEvents: boolean; // início/fim de desafio
  // Mensagens diretas
  directMessages: boolean;
  // Treino
  workoutReminder: boolean;
  restTimer: boolean;
  // Canal
  webPush: boolean;
};

const DEFAULTS: NotificationPrefs = {
  rankChange: true,
  deadline: true,
  otherCheckins: true,
  groupMessages: true,
  groupEvents: true,
  directMessages: true,
  workoutReminder: true,
  restTimer: true,
  webPush: false,
};

const KEY = "carga:notification-prefs";

function read(): NotificationPrefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export function useNotificationPrefs() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULTS);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported",
  );

  useEffect(() => {
    setPrefs(read());
  }, []);

  // Reavalia a permissão ao voltar para a aba (o usuário pode ter desbloqueado
  // nas configurações do navegador sem recarregar a página).
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const sync = () => setPermission(Notification.permission);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);


  const update = useCallback((patch: Partial<NotificationPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return "unsupported" as const;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") update({ webPush: true });
    return result;
  }, [update]);

  return { prefs, update, permission, requestPermission };
}
